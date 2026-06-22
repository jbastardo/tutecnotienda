import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const storeDomain = process.env.SELLIBRI_STORE_DOMAIN || "(no seteado)";
  const apiUrl = process.env.SELLIBRI_API_URL || "(no seteado)";

  const count = await prisma.product.count();
  const sample = await prisma.product.findMany({
    select: { name: true, sellibriUrl: true, cost: true, sellPrice: true, images: true },
    take: 3,
  });

  return NextResponse.json({
    env: { storeDomain, apiUrl },
    totalProducts: count,
    sample,
  });
}
