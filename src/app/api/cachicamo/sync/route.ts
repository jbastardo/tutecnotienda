import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProduct, isConfigured } from "@/lib/cachicamo";

export async function POST(request: Request) {
  const body = await request.json();
  const { productId } = body;

  if (!productId) {
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: "Cachicamo no configurado" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const result = await createProduct({
    name: product.name,
    sku: product.sku || undefined,
    price: Number(product.sellPrice),
    cost: Number(product.cost),
    description: product.description || undefined,
    barcode: undefined,
    stock: 0,
  });

  return NextResponse.json({ ok: !!result });
}
