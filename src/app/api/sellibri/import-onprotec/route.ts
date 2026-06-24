import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, fetchTaxons, createProduct, isConfigured } from "@/lib/sellibri";
import { fetchPricelistPrices, fetchOdooBrands, fetchOdooCategories, fetchOdooStock } from "@/lib/odoo";

const ONPROTEC_CONFIG = {
  apiKey: "2uNyT2EUSyBVXx5yhYBS5AFPSbyhQqCp9MdupF3CyUGv6a9JtB1EtQTbwf7P6fqeLHjjAN2Z8uoMfnMrMv9usFMmwffGNTLeU2qP",
  apiUrl: "https://onprotec.com/api/v1",
  storeDomain: "onprotec.com",
};

export async function POST(request: Request) {
  const body = await request.json();
  const { supplierId, margin = "40", syncOnly = false } = body;
  const marginPct = Number(margin) / 100;

  // Mode 2: Only sync existing unsynced products (skip Odoo fetch)
  if (syncOnly) {
    return await syncUnsynced(marginPct);
  }

  // Mode 1: Full import from Onprotec
  let effectiveSupplierId = supplierId;
  if (!effectiveSupplierId) {
    let supplier = await prisma.supplier.findUnique({ where: { slug: "onprotec" } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: "Onprotec", slug: "onprotec", description: "Productos importados via API de onprotec.com" },
      });
    }
    effectiveSupplierId = supplier.id;
  }

  console.log("[Onprotec] Sellibri configurado:", isConfigured());
  console.log("[Onprotec] Cargando datos de Odoo...");
  const odooPriceMap = await fetchPricelistPrices("Precio 4");
  console.log(`[Onprotec] Precio 4: ${odooPriceMap.size} SKUs con precio`);
  const odooStockMap = await fetchOdooStock();
  console.log(`[Onprotec] Stock Odoo: ${odooStockMap.size} SKUs con stock`);
  const odooBrandMap = await fetchOdooBrands();
  console.log(`[Onprotec] Marcas Odoo: ${odooBrandMap.size} SKUs`);
  const odooCatMap = await fetchOdooCategories();
  console.log(`[Onprotec] Categorias Odoo: ${odooCatMap.size} SKUs`);
  const taxonMap = await fetchTaxons();
  console.log(`[Onprotec] Taxones Sellibri: ${taxonMap.size}`);

  const result = await fetchAllProducts(ONPROTEC_CONFIG, (page, total) => {
    console.log(`[Onprotec] Pagina ${page}/${total}`);
  });

  if (result.error && result.products.length === 0) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let synced = 0;
  let syncErrors = 0;
  let skippedNoProfit = 0;
  let skippedExisting = 0;
  let sampleLogged = 0;

  for (const sp of result.products) {
    try {
      const odooCost = sp.sku ? odooPriceMap.get(sp.sku) : undefined;
      const odooStock = sp.sku ? (odooStockMap.get(sp.sku) || 0) : 0;
      const effectiveCost = odooCost || Number(sp.cost) || 0;
      const sellPrice = effectiveCost * (1 + marginPct);
      const brand = sp.sku ? (odooBrandMap.get(sp.sku) || null) : null;
      const profit = sellPrice - effectiveCost;

      if (profit < 60) {
        skipped++;
        skippedNoProfit++;
        if (sampleLogged < 3) {
          console.log(`[Onprotec] SKIP (profit) "${sp.title}" SKU=${sp.sku} cost=${effectiveCost} sell=${sellPrice.toFixed(2)} profit=${profit.toFixed(2)}`);
          sampleLogged++;
        }
        continue;
      }

      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { sellibriId: String(sp.sellibriId) },
            ...(sp.sku ? [{ sku: sp.sku }] : []),
          ],
        },
      });

      if (existing) {
        const costChanged = Math.abs(Number(existing.cost) - effectiveCost) > 0.01;
        const stockChanged = (existing.stock ?? 0) !== odooStock;
        const brandChanged = brand && existing.brand !== brand;
        const nameChanged = sp.title !== existing.name;
        const imagesChanged = sp.images.length > 0 && JSON.stringify(sp.images) !== JSON.stringify(existing.images);
        const needsUpdate = costChanged || stockChanged || brandChanged || nameChanged || imagesChanged;

        if (needsUpdate) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: sp.title, cost: effectiveCost, sellPrice, profit, margin: marginPct,
              stock: odooStock, brand: brand || existing.brand,
              images: sp.images.length > 0 ? sp.images : existing.images,
            },
          });
          updated++;
        }

        // Sync to Sellibri if not yet synced
        if (!existing.synced && sp.sku) {
          const syncOk = await syncProductToSellibri(existing.id, {
            title: sp.title, price: sellPrice, cost: effectiveCost, sku: sp.sku, images: sp.images, stock: odooStock,
          });
          if (syncOk) synced++; else syncErrors++;
        } else if (!needsUpdate) {
          skipped++;
          skippedExisting++;
        }
        continue;
      }

      // Create new product in local DB
      const product = await prisma.product.create({
        data: {
          name: sp.title, description: sp.description || null, sku: sp.sku || null,
          cost: effectiveCost, sellPrice, profit, margin: marginPct, stock: odooStock, brand,
          supplierId: effectiveSupplierId,
          sellibriId: null, sellibriUrl: null,
          synced: false, status: "draft", images: sp.images,
        },
      });
      imported++;

      // Sync to Sellibri
      if (sp.sku) {
        const syncOk = await syncProductToSellibri(product.id, {
          title: sp.title, price: sellPrice, cost: effectiveCost, sku: sp.sku, images: sp.images, stock: odooStock,
        });
        if (syncOk) synced++; else syncErrors++;
      }
    } catch (e: any) {
      skipped++;
      console.error(`[Onprotec] Error procesando "${sp.title}":`, e.message || e);
    }
  }

  console.log(`[Onprotec] RESULTADO: total=${result.products.length} importado=${imported} actualizado=${updated} saltado=${skipped} sincronizado=${synced} errSync=${syncErrors}`);

  return NextResponse.json({
    total: result.products.length,
    imported,
    updated,
    skipped,
    synced,
    syncErrors,
    skippedNoProfit,
    skippedExisting,
  });
}

// Sync unsynced Onprotec products (no Odoo fetch needed)
async function syncUnsynced(marginPct: number) {
  const unsynced = await prisma.product.findMany({
    where: { synced: false, supplier: { slug: "onprotec" }, sku: { not: null } },
    include: { supplier: true },
    take: 500,
  });

  console.log(`[Onprotec] Sync-only mode: ${unsynced.length} productos sin sincronizar`);
  let synced = 0;
  let errors = 0;

  for (const p of unsynced) {
    const ok = await syncProductToSellibri(p.id, {
      title: p.name, price: Number(p.sellPrice), cost: Number(p.cost), sku: p.sku!, images: p.images, stock: p.stock ?? 0,
    });
    if (ok) synced++; else errors++;
  }

  return NextResponse.json({ total: unsynced.length, synced, errors });
}

// Helper: sync a single product to Sellibri and update local DB
async function syncProductToSellibri(
  productId: string,
  data: { title: string; price: number; cost: number; sku: string; images: string[]; stock: number }
): Promise<boolean> {
  try {
    const result = await createProduct({
      title: data.title,
      price: data.price,
      cost: data.cost,
      sku: data.sku,
      status: "active",
      tags: ["onprotec", "tutecnotienda"],
      available: data.stock,
      images: data.images.length > 0 ? data.images : undefined,
    });

    if (result?.id) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          synced: true,
          sellibriId: String(result.id),
          sellibriUrl: `https://tutecnotienda.com/p/${result.slug || result.id}`,
          status: "published",
        },
      });
      console.log(`[Onprotec] Synced: ${data.title} -> sellibriId=${result.id}`);
      return true;
    }

    console.error(`[Onprotec] createProduct returned null for "${data.title}" (SKU: ${data.sku})`);
    return false;
  } catch (e: any) {
    console.error(`[Onprotec] Sync error for "${data.title}":`, e.message || e);
    return false;
  }
}
