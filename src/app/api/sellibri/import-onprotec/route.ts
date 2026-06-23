import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts } from "@/lib/sellibri";
import { fetchPricelistPrices } from "@/lib/odoo";

const ONPROTEC_CONFIG = {
  apiKey: "2uNyT2EUSyBVXx5yhYBS5AFPSbyhQqCp9MdupF3CyUGv6a9JtB1EtQTbwf7P6fqeLHjjAN2Z8uoMfnMrMv9usFMmwffGNTLeU2qP",
  apiUrl: "https://onprotec.com/api/v1",
  storeDomain: "onprotec.com",
};

export async function POST(request: Request) {
  const body = await request.json();
  const { supplierId } = body;

  // Get Precio 4 from Odoo
  const odooPriceMap = await fetchPricelistPrices("Precio 4");

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
      const effectiveCost = odooCost || Number(sp.cost) || 0;
      const sellPrice = effectiveCost * 1.40;
      const profit = sellPrice - effectiveCost;

      // Skip if profit too low
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
        if (Math.abs(Number(existing.cost) - effectiveCost) > 0.01) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { name: sp.title, cost: effectiveCost, sellPrice, profit, margin: 0.40, images: sp.images.length > 0 ? sp.images : existing.images },
          });
          updated++;
        } else { skipped++; }
        continue;
      }

      const product = await prisma.product.create({
        data: {
          name: sp.title, description: sp.description || null, sku: sp.sku || null,
          cost: effectiveCost, sellPrice, profit, margin: 0.40,
          supplierId: supplierId || null,
          sellibriId: null,
          sellibriUrl: null,
          synced: false, status: "draft", images: sp.images,
        },
      });
      imported++;

      // Auto-sync to tutecnotienda.com
      if (sp.sku) {
        try {
          const syncRes = await fetch(`${process.env.SELLIBRI_API_URL || "https://tutecnotienda.com/api/v1"}/products`, {
            method: "POST",
            headers: { "X-Api-Key": process.env.SELLIBRI_API_KEY || "", "Content-Type": "application/json" },
            body: JSON.stringify({
              product: {
                title: sp.title,
                sku: sp.sku,
                status: "active",
                master_attributes: { price: String(sellPrice.toFixed(2)), cost: String(effectiveCost.toFixed(2)), sku: sp.sku },
              },
            }),
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            const newId = syncData.product?.id || syncData.id;
            await prisma.product.update({
              where: { id: product.id },
              data: {
                synced: true,
                sellibriId: newId ? String(newId) : null,
                sellibriUrl: newId ? `https://tutecnotienda.com/p/${newId}` : null,
                status: "published",
              },
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
