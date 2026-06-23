import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, fetchTaxons, createProduct } from "@/lib/sellibri";
import { fetchPricelistPrices, fetchOdooBrands, fetchOdooCategories, fetchOdooStock } from "@/lib/odoo";

const ONPROTEC_CONFIG = {
  apiKey: "2uNyT2EUSyBVXx5yhYBS5AFPSbyhQqCp9MdupF3CyUGv6a9JtB1EtQTbwf7P6fqeLHjjAN2Z8uoMfnMrMv9usFMmwffGNTLeU2qP",
  apiUrl: "https://onprotec.com/api/v1",
  storeDomain: "onprotec.com",
};

export async function POST(request: Request) {
  const body = await request.json();
  const { supplierId, margin = "40" } = body;
  const marginPct = Number(margin) / 100;

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

  const odooPriceMap = await fetchPricelistPrices("Precio 4");
  const odooStockMap = await fetchOdooStock();
  const odooBrandMap = await fetchOdooBrands();
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
  let skipped = 0;

  for (const sp of result.products) {
    try {
      const odooCost = sp.sku ? odooPriceMap.get(sp.sku) : undefined;
      const odooStock = sp.sku ? (odooStockMap.get(sp.sku) || 0) : 0;
      const effectiveCost = odooCost || Number(sp.cost) || 0;
      const sellPrice = effectiveCost * (1 + marginPct);
      const brand = sp.sku ? (odooBrandMap.get(sp.sku) || null) : null;
      const profit = sellPrice - effectiveCost;

      if (profit <= 100) {
        skipped++;
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
        if (Math.abs(Number(existing.cost) - effectiveCost) > 0.01 || (existing.stock ?? 0) !== odooStock) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { name: sp.title, cost: effectiveCost, sellPrice, profit, margin: 0.40, stock: odooStock, brand, images: sp.images.length > 0 ? sp.images : existing.images },
          });
          updated++;
        } else { skipped++; }
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
        try {
          const syncResult = await createProduct({
            title: sp.title,
            price: sellPrice,
            cost: effectiveCost,
            sku: sp.sku,
            status: "active",
            tags: ["onprotec", "tutecnotienda"],
            available: odooStock,
          });
          if (syncResult?.id) {
            await prisma.product.update({
              where: { id: product.id },
              data: { synced: true, sellibriId: String(syncResult.id), sellibriUrl: `https://tutecnotienda.com/p/${syncResult.slug}`, status: "published" },
            });
          }
        } catch (e) { console.error("[Onprotec] Sync error:", e); }
      }
    } catch (e) { skipped++; }
  }

  return NextResponse.json({
    total: result.products.length,
    imported,
    updated,
    skipped,
  });
}
