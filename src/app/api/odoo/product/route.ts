import { NextResponse } from "next/server";
import { getProductPrices } from "@/lib/odoo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku");
  if (!sku) return NextResponse.json({ error: "sku requerido" }, { status: 400 });
  const result = await getProductPrices(sku);
  return NextResponse.json(result);
}
