import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, isConfigured, getStoreDomain, generateSlug } from "@/lib/sellibri";

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Sellibri no configurado" },
      { status: 400 }
    );
  }

  const storeDomain = getStoreDomain();

  const body = await request.json();
  const { supplierId } = body;

  let imported = 0;
  let skipped = 0;
  let updated = 0;
  let errors: string[] = [];

  const result = await fetchAllProducts((page, total) => {
    console.log(`[Import] Pagina ${page}/${total}`);
  });

  if (result.error && result.products.length === 0) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const allProducts = result.products;

  for (const sp of allProducts) {
    try {
      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { sellibriId: String(sp.sellibriId) },
            ...(sp.sku ? [{ sku: sp.sku }] : []),
          ],
        },
      });

      if (existing) {
        // Update existing product with latest data and images
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: sp.title,
            cost: sp.cost,
            sellPrice: sp.price,
            profit: sp.price - sp.cost,
            margin: sp.price > 0 ? (sp.price - sp.cost) / sp.price : 0,
            images: sp.images.length > 0 ? sp.images : existing.images,
            sellibriUrl: `https://${storeDomain}/p/${generateSlug(sp.title)}`,
          },
        });
        if (supplierId && !existing.supplierId) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { supplierId },
          });
        }
        updated++;
        continue;
      }

      await prisma.product.create({
        data: {
          name: sp.title,
          description: sp.description || null,
          sku: sp.sku || null,
          cost: sp.cost,
          sellPrice: sp.price,
          profit: sp.price - sp.cost,
          margin: sp.price > 0 ? (sp.price - sp.cost) / sp.price : 0,
          supplierId: supplierId || null,
          sellibriId: String(sp.sellibriId),
          sellibriUrl: `https://${storeDomain}/p/${generateSlug(sp.title)}`,
          synced: true,
          status: "published",
          images: sp.images,
        },
      });

      imported++;
    } catch (e) {
      errors.push(`Error con ${sp.title}: ${e}`);
    }
  }

  return NextResponse.json({
    total: allProducts.length,
    imported,
    updated,
    skipped,
    errors: errors.slice(0, 10),
  });
}
