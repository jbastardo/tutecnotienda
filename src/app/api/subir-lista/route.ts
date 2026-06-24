import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processUploadedFile } from "@/lib/price-list";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const supplierId = formData.get("supplierId") as string | null;
    const marginParam = formData.get("margin") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    if (!supplierId) {
      return NextResponse.json({ error: "Proveedor requerido" }, { status: 400 });
    }

    // Use supplier's margin if not provided in form
    let margin: number;
    if (marginParam) {
      margin = parseFloat(marginParam) || 0.4;
    } else {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { margin: true } });
      margin = Number(supplier?.margin || 0.4);
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

    console.log(`[SubirLista] Procesando ${file.name} (${(buffer.byteLength / 1024).toFixed(0)} KB) con margen ${margin}%`);
    const result = await processUploadedFile(supplierId, file.name, buffer, margin / 100);

    const priceList = await prisma.priceList.findUnique({
      where: { id: result.priceListId },
      include: {
        products: {
          orderBy: { profit: "desc" },
          take: 200,
        },
      },
    });

    return NextResponse.json({ ...priceList, _headers: result.headers, _errors: result.errors }, { status: 201 });
  } catch (error: any) {
    console.error("[SubirLista] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}
