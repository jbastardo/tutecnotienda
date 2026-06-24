import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, fetchTaxons, createProduct, updateProductOnSellibri, searchProductBySku, updateProductVariant, isConfigured, getStoreDomain } from "@/lib/sellibri";
import { fetchPricelistPrices, fetchOdooBrands, fetchOdooCategories, fetchOdooStock } from "@/lib/odoo";

const ONPROTEC_CONFIG = {
  apiKey: "2uNyT2EUSyBVXx5yhYBS5AFPSbyhQqCp9MdupF3CyUGv6a9JtB1EtQTbwf7P6fqeLHjjAN2Z8uoMfnMrMv9usFMmwffGNTLeU2qP",
  apiUrl: "https://onprotec.com/api/v1",
  storeDomain: "onprotec.com",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supplierId, margin, syncOnly = false } = body;

    if (syncOnly) {
      return await syncUnsynced();
    }

    // Get or create Onprotec supplier
    let effectiveSupplierId = supplierId;
    let supplier;
    if (!effectiveSupplierId) {
      supplier = await prisma.supplier.findUnique({ where: { slug: "onprotec" } });
      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: { name: "Onprotec", slug: "onprotec", description: "Productos importados via API de onprotec.com", margin: 0.4 },
        });
      }
      effectiveSupplierId = supplier.id;
    } else {
      supplier = await prisma.supplier.findUnique({ where: { id: effectiveSupplierId } });
    }

    // Use supplier's margin if not provided in request
    const marginPct = margin !== undefined ? Number(margin) / 100 : Number(supplier?.margin || 0.4);

    console.log("[Onprotec] Iniciando import. Sellibri configurado:", isConfigured());
    console.log("[Onprotec] Supplier ID:", effectiveSupplierId, "Margen:", marginPct);

  const odooPriceMap = await fetchPricelistPrices("Precio 4");
  console.log(`[Onprotec] Precio 4: ${odooPriceMap.size} SKUs`);
  const odooStockMap = await fetchOdooStock();
  console.log(`[Onprotec] Stock: ${odooStockMap.size} SKUs`);
  const odooBrandMap = await fetchOdooBrands();
  console.log(`[Onprotec] Marcas: ${odooBrandMap.size} SKUs`);
  const odooCatMap = await fetchOdooCategories();
  const taxonMap = await fetchTaxons();

  const result = await fetchAllProducts(ONPROTEC_CONFIG, (page, total) => {
    console.log(`[Onprotec] Pagina ${page}/${total}`);
  });

  if (result.error && result.products.length === 0) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  let imported = 0;
  let updated = 0;
  let synced = 0;
  let syncErrors = 0;
  let skipped = 0;
  let skippedNoProfit = 0;
  let skippedExisting = 0;
  const processedSkus = new Set<string>();

  for (const sp of result.products) {
    try {
      if (sp.sku) processedSkus.add(sp.sku);
      const odooCost = sp.sku ? odooPriceMap.get(sp.sku) : undefined;
      const odooStock = sp.sku ? (odooStockMap.get(sp.sku) || 0) : 0;
      const effectiveCost = odooCost || Number(sp.cost) || 0;
      const sellPrice = effectiveCost * (1 + marginPct);
      const brand = sp.sku ? (odooBrandMap.get(sp.sku) || null) : null;
      const profit = sellPrice - effectiveCost;

      // Find existing product by SKU or sellibriId
      const existing = sp.sku
        ? await prisma.product.findFirst({ where: { sku: sp.sku } })
        : await prisma.product.findFirst({ where: { sellibriId: String(sp.sellibriId) } });

      if (existing) {
        // Compare all fields
        const costChanged = Math.abs(Number(existing.cost) - effectiveCost) > 0.01;
        const stockChanged = (existing.stock ?? 0) !== odooStock;
        const brandChanged = brand && existing.brand !== brand;
        const nameChanged = sp.title !== existing.name;
        const imagesChanged = sp.images.length > 0 && JSON.stringify(sp.images) !== JSON.stringify(existing.images);
        const supplierChanged = existing.supplierId !== effectiveSupplierId;
        const needsUpdate = costChanged || stockChanged || brandChanged || nameChanged || imagesChanged || supplierChanged;

        if (needsUpdate) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: sp.title, cost: effectiveCost, sellPrice, profit, margin: marginPct,
              stock: odooStock, brand: brand || existing.brand,
              supplierId: effectiveSupplierId,
              images: sp.images.length > 0 ? sp.images : existing.images,
            },
          });
          updated++;
        }

        // Sync to Sellibri if: not synced, OR data changed
        if (sp.sku && (!existing.synced || needsUpdate)) {
          if (existing.synced && existing.sellibriId) {
            // Already on Sellibri - update product + variant
            const productImages = sp.images.length > 0 ? sp.images : existing.images;
            await updateProductOnSellibri(existing.sellibriId, {
              title: sp.title,
              vendorName: brand || undefined,
              images: productImages,
            });
            const variant = await searchProductBySku(sp.sku);
            if (variant) {
              await updateProductVariant(variant.id, { price: sellPrice, cost: effectiveCost, available: odooStock });
            }
            synced++;
          } else {
            // Not on Sellibri - create
            const ok = await syncProductToSellibri(existing.id, {
              title: sp.title, price: sellPrice, cost: effectiveCost, sku: sp.sku, images: sp.images, stock: odooStock,
            });
            if (ok) synced++; else syncErrors++;
          }
        } else if (!needsUpdate) {
          skipped++;
          skippedExisting++;
        }
        continue;
      }

      // New product - only create if profit >= 60
      if (profit < 60) {
        skipped++;
        skippedNoProfit++;
        continue;
      }

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

      if (sp.sku) {
        const ok = await syncProductToSellibri(product.id, {
          title: sp.title, price: sellPrice, cost: effectiveCost, sku: sp.sku, images: sp.images, stock: odooStock,
        });
        if (ok) synced++; else syncErrors++;
      }
    } catch (e: any) {
      skipped++;
      console.error(`[Onprotec] Error: "${sp.title}":`, e.message || e);
    }
  }

  console.log(`[Onprotec] RESULTADO: total=${result.products.length} importado=${imported} actualizado=${updated} sincronizado=${synced} errSync=${syncErrors} saltado=${skipped}`);

  // Dar de baja: productos Onprotec que ya no aparecen en la importacion
  let discontinued = 0;
  if (processedSkus.size > 0) {
    const outOfStock = await prisma.product.findMany({
      where: {
        supplierId: effectiveSupplierId,
        sku: { not: null, notIn: Array.from(processedSkus) },
        stock: { gt: 0 },
      },
      select: { id: true, sku: true, name: true },
    });

    if (outOfStock.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: outOfStock.map(p => p.id) } },
        data: { stock: 0 },
      });
      discontinued = outOfStock.length;
      console.log(`[Onprotec] ${discontinued} productos dados de baja (sin inventario)`);
    }
  }

  return NextResponse.json({
    total: result.products.length, imported, updated, synced, syncErrors, skipped,
    skippedNoProfit, skippedExisting, discontinued,
  });

  } catch (e: any) {
    console.error("[Onprotec] Error fatal:", e.message || e);
    return NextResponse.json({ error: e.message || "Error desconocido en import Onprotec" }, { status: 500 });
  }
}

async function syncUnsynced() {
  const unsynced = await prisma.product.findMany({
    where: { synced: false, supplier: { slug: "onprotec" }, sku: { not: null } },
    take: 500,
  });
  console.log(`[Onprotec] Sync-only: ${unsynced.length} pendientes`);
  let synced = 0, errors = 0;
  for (const p of unsynced) {
    const ok = await syncProductToSellibri(p.id, {
      title: p.name, price: Number(p.sellPrice), cost: Number(p.cost), sku: p.sku!, images: p.images, stock: p.stock ?? 0,
    });
    if (ok) synced++; else errors++;
  }
  return NextResponse.json({ total: unsynced.length, synced, errors });
}

async function syncProductToSellibri(
  productId: string,
  data: { title: string; price: number; cost: number; sku: string; images: string[]; stock: number }
): Promise<boolean> {
  try {
    const result = await createProduct({
      title: data.title, price: data.price, cost: data.cost, sku: data.sku,
      status: "active", tags: ["onprotec", "tutecnotienda"],
      available: data.stock, images: data.images.length > 0 ? data.images : undefined,
    });
    if (result?.id) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          synced: true, sellibriId: String(result.id),
          sellibriUrl: `https://tutecnotienda.com/p/${result.slug || result.id}`,
          status: "published",
        },
      });
      console.log(`[Onprotec] Synced: ${data.title} -> ${result.id}`);
      return true;
    }
    console.error(`[Onprotec] createProduct null: "${data.title}"`);
    return false;
  } catch (e: any) {
    console.error(`[Onprotec] Sync error "${data.title}":`, e.message);
    return false;
  }
}
