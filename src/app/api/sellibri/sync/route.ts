import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProductVariant, searchProductImages, isConfigured, getStoreDomain } from "@/lib/sellibri";

export async function POST(request: Request) {
  const body = await request.json();
  const { productId } = body;

  if (!productId) {
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Sellibri no esta configurado. Revisa SELLIBRI_API_KEY y SELLIBRI_STORE_DOMAIN" },
      { status: 400 }
    );
  }

  const storeDomain = getStoreDomain();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { supplier: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  if (product.synced) {
    return NextResponse.json(
      { error: "El producto ya esta sincronizado con Sellibri" },
      { status: 400 }
    );
  }

  const images = await searchProductImages(product.name);

  const result = await createProduct({
    title: product.name,
    description: product.description || undefined,
    price: Number(product.sellPrice),
    cost: Number(product.cost),
    sku: product.sku || undefined,
    vendorName: product.supplier?.name || undefined,
    images,
    tags: product.supplier?.name ? [product.supplier.name.toLowerCase(), "tutecnotienda"] : ["tutecnotienda"],
    status: "active",
  });

  if (!result) {
    return NextResponse.json(
      { error: "Error al crear producto en Sellibri" },
      { status: 500 }
    );
  }

  const variantId = result.variants?.[0]?.id;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      sellibriId: String(result.id),
      sellibriUrl: variantId
        ? `https://${storeDomain}/p/${result.slug}`
        : null,
      synced: true,
      status: "published",
    },
  });

  return NextResponse.json({
    success: true,
    sellibriId: result.id,
    variantId,
  });
}

export async function GET() {
  const synced = await prisma.product.count({ where: { synced: true } });
  const pending = await prisma.product.count({ where: { synced: false } });
  const total = await prisma.product.count();
  const configured = isConfigured();

  return NextResponse.json({
    configured,
    total,
    synced,
    pending,
  });
}
