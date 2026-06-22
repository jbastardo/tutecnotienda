import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Get all products with SKU, grouped by SKU
  const all = await prisma.product.findMany({
    where: { sku: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, sku: true },
  });

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const p of all) {
    const key = p.sku!;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    // Delete in batches of 100
    for (let i = 0; i < toDelete.length; i += 100) {
      await prisma.product.deleteMany({
        where: { id: { in: toDelete.slice(i, i + 100) } },
      });
    }
  }

  const total = await prisma.product.count();
  const synced = await prisma.product.count({ where: { synced: true } });

  return NextResponse.json({ deleted: toDelete.length, total, synced });
}
