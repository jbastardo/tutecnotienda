import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDescription, searchProductImages } from "@/lib/ia";
import { isConfigured as isSellibriConfigured } from "@/lib/sellibri";

export async function GET() {
  const gemini = !!process.env.GEMINI_API_KEY;
  const unsplash = !!process.env.UNSPLASH_ACCESS_KEY;
  return NextResponse.json({ gemini, unsplash, configured: gemini && unsplash });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { productId, overwrite } = body;

  if (!productId) {
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { supplier: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // Skip if already has description and images and not forcing overwrite
  if (!overwrite && product.description && product.images.length > 0) {
    return NextResponse.json({ action: "skipped", reason: "ya tiene descripcion e imagenes" });
  }

  const result: Record<string, any> = { action: "processed" };

  // Generate description if missing
  if (overwrite || !product.description) {
    const desc = await generateDescription(
      product.name,
      product.sku || undefined,
      undefined, // category
      product.supplier?.name || undefined
    );
    if (desc) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: desc },
      });
      result.description = "generada";
    } else {
      result.description = "fallo";
    }
  } else {
    result.description = "omitida";
  }

  // Search images if missing
  if (overwrite || product.images.length === 0) {
    const searchQuery = product.name.substring(0, 100).replace(/[^\w\s]/g, "");
    const images = await searchProductImages(searchQuery);
    if (images.length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images },
      });
      result.images = `${images.length} encontradas`;
    } else {
      result.images = "ninguna encontrada";
    }
  } else {
    result.images = "omitidas";
  }

  // If product is synced to Sellibri, update there too
  if (product.synced && product.sellibriId && isSellibriConfigured()) {
    // Update product description via Sellibri API
    const storeDomain = process.env.SELLIBRI_STORE_DOMAIN ||
      (process.env.SELLIBRI_API_URL ? new URL(process.env.SELLIBRI_API_URL).hostname : "");
    
    try {
      await fetch(`https://${storeDomain}/api/v1/products/${product.sellibriId}`, {
        method: "PATCH",
        headers: {
          "X-Api-Key": process.env.SELLIBRI_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: {
            description: product.description || result.description !== "fallo" ? (await prisma.product.findUnique({where:{id:product.id}}))?.description : undefined,
          },
        }),
      });
      result.sellibri = "actualizado";
    } catch { result.sellibri = "error"; }
  }

  return NextResponse.json(result);
}
