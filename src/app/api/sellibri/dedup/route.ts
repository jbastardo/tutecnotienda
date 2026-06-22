import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Delete duplicate products (same sellibriId or same SKU, keep the newest)
  const duplicates = await prisma.$queryRawUnsafe<{ id: string; sku: string; sellibri_id: string }[]>(`
    SELECT id, sku, sellibri_id as sellibri_id
    FROM "Product"
    WHERE synced = true AND sellibri_id IS NOT NULL
    ORDER BY "createdAt" DESC
  `);

  const seenSkus = new Set<string>();
  const seenIds = new Set<string>();
  const toDelete: string[] = [];

  for (const p of duplicates) {
    const key = p.sku || p.sellibri_id;
    if (!key || seenSkus.has(key)) {
      toDelete.push(p.id);
    } else {
      seenSkus.add(key);
    }
  }

  if (toDelete.length > 0) {
    await prisma.product.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  const count = await prisma.product.count();
  const synced = await prisma.product.count({ where: { synced: true } });

  return NextResponse.json({ deleted: toDelete.length, total: count, synced });
}
