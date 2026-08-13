import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchManufacturerImage } from "@/lib/image-search";

export const maxDuration = 300; // 5 minutes max duration if NextJS supports it here

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        images: { isEmpty: true }
      },
      take: 200
    });

    let updated = 0;
    
    // We do it sequentially to not hammer the server/mercado libre
    for (const p of products) {
      try {
        const images = await searchManufacturerImage(p.name, p.sku || undefined, p.brand || undefined);
        if (images && images.length > 0) {
          await prisma.product.update({
            where: { id: p.id },
            data: { images }
          });
          updated++;
        }
      } catch (err) {
        console.error(`Error fetching image for ${p.name}:`, err);
      }
    }

    return NextResponse.json({ success: true, processed: products.length, updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
