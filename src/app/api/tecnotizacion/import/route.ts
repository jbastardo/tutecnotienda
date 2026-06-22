import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProducts, isConfigured } from "@/lib/tecnotizacion";
import { createProduct, searchProductBySku, isConfigured as isSellibriConfigured, getStoreDomain, generateSlug } from "@/lib/sellibri";

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Tecnotizacion no configurado" }, { status: 400 });
  }

  const products = await fetchProducts();
  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: "No se encontraron productos en Tecnotizacion" }, { status: 400 });
  }

  let imported = 0;
  let synced = 0;
  let skipped = 0;

  for (const tp of products) {
    if (!tp.name) continue;

    // Check if exists locally by SKU
    const existingLocal = tp.sku
      ? await prisma.product.findFirst({ where: { sku: tp.sku } })
      : null;

    if (existingLocal) {
      skipped++;
      continue;
    }

    // Create locally
    const product = await prisma.product.create({
      data: {
        name: tp.name,
        sku: tp.sku || null,
        description: tp.description || null,
        cost: tp.costUsd || 0,
        sellPrice: (tp.costUsd || 0) / 0.55, // cost / (1 - 0.45) with default 45% margin
        profit: ((tp.costUsd || 0) / 0.55) - (tp.costUsd || 0),
        margin: 0.45,
        images: tp.imageUrl ? [tp.imageUrl] : [],
        status: "draft",
      },
    });
    imported++;

    // Sync to Sellibri
    if (isSellibriConfigured() && tp.sku) {
      const existingWeb = await searchProductBySku(tp.sku);
      if (!existingWeb) {
        const result = await createProduct({
          title: tp.name,
          description: tp.description || "",
          price: Number(product.sellPrice),
          cost: Number(product.cost),
          sku: tp.sku,
          status: "active",
        });

        if (result) {
          const storeDomain = getStoreDomain();
          await prisma.product.update({
            where: { id: product.id },
            data: {
              sellibriId: String(result.id),
              sellibriUrl: `https://${storeDomain}/p/${result.slug || generateSlug(tp.name)}`,
              synced: true,
              status: "published",
            },
          });
          synced++;
        }
      }
    }
  }

  return NextResponse.json({
    total: products.length,
    imported,
    synced,
    skipped,
  });
}
