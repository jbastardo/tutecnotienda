import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchProductBySku, updateProductVariant } from "@/lib/sellibri";

export async function POST(request: Request) {
  const body = await request.json();
  const { excludeSkus } = body;

  if (!excludeSkus || !Array.isArray(excludeSkus)) {
    return NextResponse.json({ error: "excludeSkus requerido" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: {
      synced: true,
      sellibriId: { not: null },
      sku: { notIn: excludeSkus.filter(Boolean) },
    },
    select: { id: true, sku: true, sellibriId: true },
  });

  let updated = 0;
  for (const p of products) {
    if (!p.sku) continue;
    try {
      const variant = await searchProductBySku(p.sku);
      if (variant && variant.id) {
        await updateProductVariant(variant.id, { available: 0 });
        updated++;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 350));
  }

  return NextResponse.json({ updated, total: products.length });
}
