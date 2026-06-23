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
      // Use Odoo pricelist price (Precio 4) if available, otherwise use variant cost
      const odooCost = sp.sku ? odooPriceMap.get(sp.sku) : undefined;
      const effectiveCost = odooCost || Number(sp.cost) || 0;
      const sellPrice = effectiveCost * 1.40;
      const profit = sellPrice - effectiveCost;

      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { sellibriId: String(sp.sellibriId) },
            ...(sp.sku ? [{ sku: sp.sku }] : []),
          ],
        },
      });

      if (existing) {
        // Only update if price changed
        if (Math.abs(Number(existing.cost) - effectiveCost) > 0.01) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: sp.title,
              cost: effectiveCost,
              sellPrice,
              profit,
              margin: 0.40,
              images: sp.images.length > 0 ? sp.images : existing.images,
            },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      await prisma.product.create({
        data: {
          name: sp.title,
          description: sp.description || null,
          sku: sp.sku || null,
          cost: effectiveCost,
          sellPrice,
          profit,
          margin: 0.40,
          supplierId: supplierId || null,
          sellibriId: String(sp.sellibriId),
          sellibriUrl: `https://onprotec.com/p/${sp.slug || sp.sellibriId}`,
          synced: true,
          status: "published",
          images: sp.images,
        },
      });
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  return NextResponse.json({
    total: result.products.length,
    imported,
    updated,
    skipped,
  });
}
