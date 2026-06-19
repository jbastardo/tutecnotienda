import { NextResponse } from "next/server";
import { testConnection } from "@/lib/sellibri";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "db") {
    const storeDomain =
      process.env.SELLIBRI_STORE_DOMAIN ||
      (process.env.SELLIBRI_API_URL
        ? new URL(process.env.SELLIBRI_API_URL).hostname
        : "(no configurado)");

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

  const result = await testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
