import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { supplier: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const fields = ["name", "description", "sku", "cost", "sellPrice", "profit", "margin", "brand", "category", "warranty", "stock", "status", "images", "supplierId"];

  for (const field of fields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  // Recalculate profit if cost or sellPrice changed
  if (data.cost !== undefined || data.sellPrice !== undefined) {
    const cost = Number(data.cost ?? existing.cost);
    const sellPrice = Number(data.sellPrice ?? existing.sellPrice);
    data.profit = sellPrice - cost;
  }

  const product = await prisma.product.update({
    where: { id },
    data,
    include: { supplier: true },
  });

  return NextResponse.json(product);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
