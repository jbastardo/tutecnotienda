import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProductVariant, searchProductBySku, searchProductImages, isConfigured, getStoreDomain } from "@/lib/sellibri";

export async function POST(request: Request) {
  const body = await request.json();
  const { productId, available } = body;

  if (!productId) {
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Sellibri no configurado" },
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

  const stockToUpdate = available ?? 0;

  // If already synced, update the existing product
  if (product.synced && product.sellibriId) {
    if (product.sku) {
      const existingVariant = await searchProductBySku(product.sku);
      if (existingVariant) {
        await updateProductVariant(existingVariant.id, {
          price: Number(product.sellPrice),
          cost: Number(product.cost),
          available: stockToUpdate,
        });
        return NextResponse.json({ success: true, action: "updated_existing", variantId: existingVariant.id });
      }
    }
    return NextResponse.json({ success: true, action: "already_synced" });
  }

  // Check if SKU already exists in Sellibri
  if (product.sku) {
    const existingVariant = await searchProductBySku(product.sku);
    if (existingVariant) {
      // Update existing product's variant with new price and stock
      await updateProductVariant(existingVariant.id, {
        price: Number(product.sellPrice),
        cost: Number(product.cost),
        available: stockToUpdate,
      });

      await prisma.product.update({
        where: { id: product.id },
        data: {
          sellibriId: String(existingVariant.product_id),
          sellibriUrl: `https://${storeDomain}/p/${existingVariant.product_id}`,
          synced: true,
          status: "published",
        },
      });

      return NextResponse.json({
        success: true,
        action: "updated_existing",
        sellibriId: existingVariant.product_id,
        variantId: existingVariant.id,
      });
    }
  }

  // Create new product in Sellibri
  const existingImages = product.images && product.images.length > 0 ? product.images : await searchProductImages(product.name);

  const result = await createProduct({
    title: product.name,
    description: product.description || undefined,
    price: Number(product.sellPrice),
    cost: Number(product.cost),
    sku: product.sku || undefined,
    vendorName: product.brand || product.supplier?.name || undefined,
    images: existingImages,
    tags: product.brand ? [product.brand.toLowerCase(), "tutecnotienda"] : (product.supplier?.name ? [product.supplier.name.toLowerCase(), "tutecnotienda"] : ["tutecnotienda"]),
    status: "active",
  });

  if (!result) {
    return NextResponse.json(
      { error: "Error al crear producto en Sellibri" },
      { status: 500 }
    );
  }

  const variantId = result.variants?.[0]?.id;

  // Update stock if variant was created
  if (variantId && stockToUpdate > 0) {
    await updateProductVariant(variantId, { available: stockToUpdate });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      sellibriId: String(result.id),
      sellibriUrl: `https://${storeDomain}/p/${result.slug}`,
      synced: true,
      status: "published",
    },
  });

  return NextResponse.json({
    success: true,
    action: "created",
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
