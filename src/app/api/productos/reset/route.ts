import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Delete in correct order to respect foreign keys
    const supplierProducts = await prisma.supplierProduct.deleteMany({});
    const priceListProducts = await prisma.priceListProduct.deleteMany({});
    const priceLists = await prisma.priceList.deleteMany({});
    const products = await prisma.product.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: {
        products: products.count,
        priceListProducts: priceListProducts.count,
        priceLists: priceLists.count,
        supplierProducts: supplierProducts.count,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
