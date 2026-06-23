import { NextResponse } from "next/server";
import { testConnection, getProductPrices } from "@/lib/odoo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku");

  if (sku) {
    const prices = await getProductPrices(sku);
    return NextResponse.json(prices);
  }

  const result = await testConnection();
  return NextResponse.json(result);
}
