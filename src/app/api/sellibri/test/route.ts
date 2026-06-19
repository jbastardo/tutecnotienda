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

  const result = await testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
