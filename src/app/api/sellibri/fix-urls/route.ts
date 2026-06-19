import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, isConfigured } from "@/lib/sellibri";

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Sellibri no configurado" }, { status: 400 });
  }

  const storeDomain = process.env.SELLIBRI_STORE_DOMAIN || "tutecnotienda.com";

  // Re-fetch product slugs from Sellibri
  const result = await fetchAllProducts();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const slugMap = new Map(result.products.map((p) => [String(p.sellibriId), p.slug]));

  const products = await prisma.product.findMany({
    where: { synced: true, sellibriId: { not: null } },
    select: { id: true, sellibriId: true },
  });

  let fixed = 0;
  for (const p of products) {
    const slug = slugMap.get(String(p.sellibriId)) || p.sellibriId;
    const newUrl = `https://${storeDomain}/products/${slug}`;
    await prisma.product.update({
      where: { id: p.id },
      data: { sellibriUrl: newUrl },
    });
    fixed++;
  }

  return NextResponse.json({ ok: true, fixed, storeDomain });
}
