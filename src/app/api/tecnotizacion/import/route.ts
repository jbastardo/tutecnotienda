import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProducts, isConfigured } from "@/lib/tecnotizacion";
import { createWooProduct, getWooProductBySku } from "@/lib/woocommerce";

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
  let updated = 0;
  let skipped = 0;

  for (const tp of products) {
    if (!tp.name) continue;

    // Check if exists locally by SKU
    const existingLocal = tp.sku
      ? await prisma.product.findFirst({ where: { sku: tp.sku } })
      : null;

    if (existingLocal) {
      // Update if something changed
      const cost = tp.costUsd || 0;
      const sellPrice = cost / 0.55;
      const costChanged = Math.abs(Number(existingLocal.cost) - cost) > 0.01;
      const nameChanged = tp.name !== existingLocal.name;

      if (costChanged || nameChanged) {
        await prisma.product.update({
          where: { id: existingLocal.id },
          data: {
            name: tp.name,
            description: tp.description || existingLocal.description,
            cost: cost,
            sellPrice: sellPrice,
            profit: sellPrice - cost,
            images: tp.imageUrl ? [tp.imageUrl] : existingLocal.images,
          },
        });
        updated++;
      } else {
        skipped++;
      }
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

    // Sync to WooCommerce
    if (process.env.WOOCOMMERCE_KEY && tp.sku) {
      const existingWeb = await getWooProductBySku(tp.sku);
      if (!existingWeb) {
        const result = await createWooProduct({
          name: tp.name,
          description: tp.description || "",
          regular_price: String(product.sellPrice),
          sku: tp.sku,
          status: "publish",
        });

        if (result && result.id) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              wooId: result.id,
              wooUrl: result.permalink,
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
    updated,
    synced,
    skipped,
  });
}
