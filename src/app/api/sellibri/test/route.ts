import { NextResponse } from "next/server";
import { testConnection, getStoreDomain } from "@/lib/sellibri";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "db") {
    const storeDomain = getStoreDomain();
    const apiUrl = process.env.SELLIBRI_API_URL || "(no seteado)";
    const count = await prisma.product.count().catch(() => -1);
    const sample = await prisma.product
      .findMany({
        select: { name: true, sellibriUrl: true, cost: true, sellPrice: true },
        take: 3,
      })
      .catch(() => []);

    return NextResponse.json({ storeDomain, apiUrl, totalProducts: count, sample });
  }

  if (mode === "raw") {
    const baseUrl = "https://tutecnotienda.com/api/v1";
    const res = await fetch(`${baseUrl}/products?per_page=1&page=1`, {
      headers: {
        "X-Api-Key": process.env.SELLIBRI_API_KEY || "",
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { error: "no es JSON", preview: text.slice(0, 500) }; }
    return NextResponse.json({ status: res.status, raw: parsed });
  }

  if (mode === "create") {
    const sku = url.searchParams.get("sku") || "TEST-" + Date.now();
    const name = url.searchParams.get("name") || "Producto de Prueba API";
    const price = parseFloat(url.searchParams.get("price") || "99.99");

    const res = await fetch("https://tutecnotienda.com/api/v1/products", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.SELLIBRI_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product: {
          title: name,
          sku: sku,
          status: "active",
          master_attributes: { price: String(price), sku: sku, cost: "50.00", track_inventory: true },
        },
      }),
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return NextResponse.json({ status: res.status, body: parsed });
  }

  const result = await testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
