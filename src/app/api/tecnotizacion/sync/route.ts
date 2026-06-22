import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendProduct, isConfigured } from "@/lib/tecnotizacion";

export async function POST(request: Request) {
  const body = await request.json();
  const { productIds } = body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: "productIds requerido" }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: "Tecnotizacion no configurado" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { supplier: true },
  });

  let sent = 0;
  let errors = 0;

  for (const p of products) {
    const ok = await sendProduct({
      name: p.name,
      sku: p.sku || undefined,
      costUsd: Number(p.cost),
      description: p.description || undefined,
      category: p.supplier?.name || undefined,
      imageUrl: p.images?.[0] || undefined,
    });

    sent++;
    if (!ok) errors++;

    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ sent, errors, total: products.length });
}
