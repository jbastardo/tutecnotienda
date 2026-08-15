import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWooProduct, updateWooProduct, getWooProductBySku, ensureWooCategory } from "@/lib/woocommerce";

export async function POST(request: Request) {
  try {
    const { productId, available } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const stock = available !== undefined ? available : (product.stock || 0);

    const imagesArray = product.images.map((src, i) => ({
      src,
      alt: product.name,
      position: i,
    }));

    // Resolve category ID in WooCommerce
    let wooCategoryId = null;
    if (product.category) {
      wooCategoryId = await ensureWooCategory(product.category);
    }

    const wooData: any = {
      name: product.name,
      regular_price: product.sellPrice.toString(),
      sku: product.sku || "",
      manage_stock: true,
      stock_quantity: stock,
      stock_status: stock > 0 ? "instock" : "outofstock",
      images: imagesArray.length > 0 ? imagesArray : undefined,
      description: product.description || "",
    };

    if (wooCategoryId) {
      wooData.categories = [{ id: wooCategoryId }];
    }

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
          status: "published",
          stock: stock,
        },
      });

      return NextResponse.json({ success: true, wooId: result.id, url: result.permalink });
    }

    return NextResponse.json({ error: "Failed to create/update in WooCommerce" }, { status: 500 });
  } catch (e: any) {
    console.error("[WooCommerce Sync] Error:", e.message || e);
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
