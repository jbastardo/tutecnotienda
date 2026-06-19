import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { mappings: true, _count: { select: { products: true } } },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  return NextResponse.json(supplier);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, description, active, mappings } = body;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  if (mappings) {
    await prisma.excelMapping.deleteMany({ where: { supplierId: id } });
    await prisma.excelMapping.createMany({
      data: mappings.map(
        (m: { key: string; columnName: string | null; columnIndex: number | null }) => ({
          supplierId: id,
          key: m.key,
          columnName: m.columnName ?? null,
          columnIndex: m.columnIndex ?? null,
        })
      ),
    });
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      name: name ?? undefined,
      description: description ?? undefined,
      active: active ?? undefined,
    },
    include: { mappings: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
