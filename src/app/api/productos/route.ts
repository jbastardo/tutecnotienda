import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const synced = searchParams.get("synced");
  const supplierId = searchParams.get("supplierId");

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (synced === "true") where.synced = true;
  if (synced === "false") where.synced = false;
  if (supplierId) where.supplierId = supplierId;

  const products = await prisma.product.findMany({
    where,
    include: { supplier: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "IDs requeridos" }, { status: 400 });
  }

  const priceListProducts = await prisma.priceListProduct.findMany({
    where: { id: { in: ids }, selected: true },
    include: { priceList: true },
  });

  if (priceListProducts.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron productos seleccionados" },
      { status: 400 }
    );
  }

  const created = [];
  for (const plp of priceListProducts) {
    const product = await prisma.product.create({
      data: {
        name: plp.name,
        description: plp.description || null,
        sku: plp.sku || null,
        cost: plp.cost,
        sellPrice: plp.sellPrice,
        profit: plp.profit,
        margin: plp.margin,
        supplierId: plp.priceList.supplierId,
        status: "draft",
      },
    });
    created.push(product);
  }

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
