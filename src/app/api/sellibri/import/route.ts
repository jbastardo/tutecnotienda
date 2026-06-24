import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllProducts, isConfigured, getStoreDomain } from "@/lib/sellibri";

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Sellibri no configurado" }, { status: 400 });
  }

  const storeDomain = getStoreDomain();
  const body = await request.json();
  const { supplierId } = body;

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors: string[] = [];

  const result = await fetchAllProducts(undefined, (page, total) => {
    console.log(`[Import] Pagina ${page}/${total}`);
  });

  if (result.error && result.products.length === 0) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  for (const sp of result.products) {
    try {
      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { sellibriId: String(sp.sellibriId) },
            ...(sp.sku ? [{ sku: sp.sku }] : []),
          ],
        },
      });

      // Use actual slug from Sellibri API response
      const sellibriUrl = sp.slug
        ? `https://${storeDomain}/p/${sp.slug}`
        : `https://${storeDomain}/p/${sp.sellibriId}`;

      if (existing) {
        const nameChanged = sp.title !== existing.name;
        const costChanged = Math.abs(Number(existing.cost) - sp.cost) > 0.01;
        const priceChanged = Math.abs(Number(existing.sellPrice) - sp.price) > 0.01;
        const imagesChanged = sp.images.length > 0 && JSON.stringify(sp.images) !== JSON.stringify(existing.images);

        if (nameChanged || costChanged || priceChanged || imagesChanged) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: sp.title, cost: sp.cost, sellPrice: sp.price,
              profit: sp.price - sp.cost,
              margin: sp.price > 0 ? (sp.price - sp.cost) / sp.price : 0,
              images: sp.images.length > 0 ? sp.images : existing.images,
              sellibriId: String(sp.sellibriId),
              sellibriUrl,
              synced: true, status: "published",
            },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      await prisma.product.create({
        data: {
          name: sp.title, description: sp.description || null, sku: sp.sku || null,
          cost: sp.cost, sellPrice: sp.price, profit: sp.price - sp.cost,
          margin: sp.price > 0 ? (sp.price - sp.cost) / sp.price : 0,
          supplierId: supplierId || null,
          sellibriId: String(sp.sellibriId), sellibriUrl,
          synced: true, status: "published", images: sp.images,
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Error con ${sp.title}: ${e}`);
    }
  }

  return NextResponse.json({ total: result.products.length, imported, updated, skipped, errors: errors.slice(0, 10) });
}
