import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processUploadedFile } from "@/lib/price-list";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const supplierId = formData.get("supplierId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (!supplierId) {
    return NextResponse.json({ error: "Proveedor requerido" }, { status: 400 });
  }

  if (
    !file.name.endsWith(".xlsx") &&
    !file.name.endsWith(".xls") &&
    !file.name.endsWith(".csv")
  ) {
    return NextResponse.json(
      { error: "Formato no soportado. Usa .xlsx, .xls o .csv" },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();

  const result = await processUploadedFile(supplierId, file.name, buffer);

  const priceList = await prisma.priceList.findUnique({
    where: { id: result.priceListId },
    include: {
      products: {
        orderBy: { profit: "desc" },
      },
    },
  });

  return NextResponse.json(priceList, { status: 201 });
}
