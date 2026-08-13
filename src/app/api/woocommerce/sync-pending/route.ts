import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const products = await prisma.product.findMany({
      where: { synced: false },
    });

    if (products.length === 0) {
      return NextResponse.json({ success: true, synced: 0, skipped: 0, errors: 0 });
    }

    let synced = 0;
    let errors = 0;
    let skipped = 0;
    
    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const results = await Promise.all(batch.map(async (product) => {
        try {
          // Calling the local WooCommerce API endpoint we created earlier
          // We can't rely on request.headers.get("origin") perfectly in Vercel/Next API Routes, 
          // Instead we can just call the functions directly!
          const { createWooProduct, updateWooProduct, getWooProductBySku } = require("@/lib/woocommerce");
          
          const imagesArray = product.images.map((src, idx) => ({
            src,
            alt: product.name,
            position: idx,
          }));

          const wooData = {
            name: product.name,
            regular_price: product.sellPrice.toString(),
            sku: product.sku || "",
            manage_stock: true,
            stock_quantity: product.stock || 0,
            stock_status: (product.stock || 0) > 0 ? "instock" : "outofstock",
            images: imagesArray.length > 0 ? imagesArray : undefined,
            description: product.description || "",
          };
          
          let result;
          if (product.wooId) {
            result = await updateWooProduct(product.wooId, wooData);
          } else {
            if (product.sku) {
              const existing = await getWooProductBySku(product.sku);
              if (existing) {
                result = await updateWooProduct(existing.id, wooData);
              } else {
                result = await createWooProduct(wooData);
              }
            } else {
              result = await createWooProduct(wooData);
            }
          }

          if (result && result.id) {
            await prisma.product.update({
              where: { id: product.id },
              data: {
                synced: true,
                wooId: result.id,
                wooUrl: result.permalink,
                status: "published"
              },
            });
            return { success: true };
          }
          return { success: false, error: "Failed to create in Woo" };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }));
      
      synced += results.filter(r => r.success).length;
      errors += results.filter(r => !r.success).length;
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      errors
    });
  } catch (e: any) {
    console.error("[WooCommerce Sync Pending] Error:", e.message || e);
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
