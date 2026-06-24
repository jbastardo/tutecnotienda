import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      _count: { select: { mappings: true, products: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, slug, description, margin, mappings } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });
  }

  const existing = await prisma.supplier.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "El slug ya existe" }, { status: 400 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      slug,
      description: description || null,
      margin: margin !== undefined ? Number(margin) / 100 : 0.4,
      mappings: {
        create: (mappings || []).map(
          (m: { key: string; columnName: string; columnIndex: number | null; sheetName?: string; skipRows?: number }) => ({
            key: m.key,
            columnName: m.columnName,
            columnIndex: m.columnIndex ?? null,
            sheetName: m.sheetName || null,
            skipRows: m.skipRows ?? 0,
          })
        ),
      },
    },
    include: { mappings: true },
  });

  return NextResponse.json(supplier, { status: 201 });
}
