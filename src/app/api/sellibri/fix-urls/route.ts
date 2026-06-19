import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, isConfigured } from "@/lib/sellibri";

export async function GET() {
  const storeDomain =
    process.env.SELLIBRI_STORE_DOMAIN ||
    (process.env.SELLIBRI_API_URL
      ? new URL(process.env.SELLIBRI_API_URL).hostname
      : "tutecnotienda.com");

  const sample = await prisma.product.findMany({
    where: { sellibriId: { not: null } },
    select: { id: true, name: true, sellibriUrl: true },
    take: 3,
  });

  return NextResponse.json({ storeDomain, sample });
}

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Sellibri no configurado" }, { status: 400 });
  }

  const storeDomain =
    process.env.SELLIBRI_STORE_DOMAIN ||
    (process.env.SELLIBRI_API_URL
      ? new URL(process.env.SELLIBRI_API_URL).hostname
      : "tutecnotienda.com");

  // Try to get real slugs from Sellibri
  let slugMap = new Map<string, string>();
  try {
    const result = await fetchAllProducts();
    if (!result.error) {
      for (const p of result.products) {
        slugMap.set(String(p.sellibriId), p.slug);
      }
    }
  } catch {}

  const products = await prisma.product.findMany({
    where: { synced: true, sellibriId: { not: null } },
    select: { id: true, sellibriId: true, sellibriUrl: true },
  });

  let fixed = 0;
  for (const p of products) {
    const slug =
      slugMap.get(String(p.sellibriId)) ||
      p.sellibriUrl?.split("/products/")[1] ||
      p.sellibriId;
    const newUrl = `https://${storeDomain}/products/${slug}`;
    if (p.sellibriUrl !== newUrl) {
      await prisma.product.update({
        where: { id: p.id },
        data: { sellibriUrl: newUrl },
      });
      fixed++;
    }
  }

  return NextResponse.json({ ok: true, fixed, storeDomain });
}
