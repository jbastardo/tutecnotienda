import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const storeDomain = process.env.SELLIBRI_STORE_DOMAIN || "tutecnotienda.com";

  const products = await prisma.product.findMany({
    where: {
      synced: true,
      sellibriId: { not: null },
      NOT: { sellibriUrl: { startsWith: `https://${storeDomain}` } },
    },
    select: { id: true, sellibriId: true, sellibriUrl: true },
    take: 200,
  });

  let fixed = 0;
  for (const p of products) {
    const slug = p.sellibriUrl?.split("/products/")[1] || p.sellibriId;
    const newUrl = `https://${storeDomain}/products/${slug}`;
    await prisma.product.update({
      where: { id: p.id },
      data: { sellibriUrl: newUrl },
    });
    fixed++;
  }

  return NextResponse.json({ ok: true, fixed });
}
