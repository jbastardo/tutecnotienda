import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProductVariant, updateProductOnSellibri, searchProductBySku, searchProductImages, isConfigured, getStoreDomain } from "@/lib/sellibri";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch (e: any) {
    console.error("[Sellibri Sync] Error parsing request body:", e.message);
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }
  
  const { productId, available } = body;

  if (!productId) {
    console.error("[Sellibri Sync] productId requerido");
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  }

  if (!isConfigured()) {
    console.error("[Sellibri Sync] Sellibri no configurado - API_KEY:", !!process.env.SELLIBRI_API_KEY, "API_URL:", process.env.SELLIBRI_API_URL);
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
    console.error(`[Sellibri Sync] Producto no encontrado: ${productId}`);
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const stockToUpdate = available ?? 0;

  console.log(`[Sellibri Sync] Procesando producto: ${product.name} (ID: ${productId}, SKU: ${product.sku}, synced: ${product.synced}, sellibriId: ${product.sellibriId})`);

  // If already synced, update the existing product on Sellibri
  if (product.synced && product.sellibriId) {
    // Update product details (title, description, vendor, images)
    const productImages = product.images && product.images.length > 0 ? product.images : undefined;
    const updateResult = await updateProductOnSellibri(product.sellibriId, {
      title: product.name,
      description: product.description || undefined,
      vendorName: product.brand || product.supplier?.name || undefined,
      tags: product.brand ? [product.brand.toLowerCase(), "tutecnotienda"] : (product.supplier?.name ? [product.supplier.name.toLowerCase(), "tutecnotienda"] : ["tutecnotienda"]),
      images: productImages,
    });

    if (!updateResult) {
      console.error(`[Sellibri Sync] Error al actualizar producto ${product.sellibriId} en Sellibri`);
      return NextResponse.json(
        { error: "Error al actualizar producto en Sellibri", sellibriId: product.sellibriId },
        { status: 500 }
      );
    }

    // Update variant price/cost/stock
    if (product.sku) {
      const existingVariant = await searchProductBySku(product.sku);
      if (existingVariant) {
        await updateProductVariant(existingVariant.id, {
          price: Number(product.sellPrice),
          cost: Number(product.cost),
          available: stockToUpdate,
        });
      }
    }

    console.log(`[Sellibri Sync] Producto actualizado: ${product.sellibriId}`);
    return NextResponse.json({ success: true, action: "updated_existing", sellibriId: product.sellibriId });
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

      console.log(`[Sellibri Sync] Producto existente encontrado y actualizado: ${existingVariant.product_id}`);
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
    console.error(`[Sellibri Sync] Error al crear producto en Sellibri: ${product.name}`);
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

  console.log(`[Sellibri Sync] Producto creado: ${result.id} (${product.name})`);
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
