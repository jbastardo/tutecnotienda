import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const emitech = await prisma.supplier.findFirst({
      where: { name: { contains: "emitech", mode: "insensitive" } },
    });

    if (emitech) {
      await prisma.excelMapping.deleteMany({
        where: { supplierId: emitech.id, key: "sellPrice" },
      });
      await prisma.excelMapping.create({
        data: {
          supplierId: emitech.id,
          key: "sellPrice",
          columnIndex: 4, // Column E
          transform: "number",
        },
      });
      return NextResponse.json({ success: true, message: `Mapping updated for Emitech (${emitech.id})` });
    } else {
      return NextResponse.json({ success: false, message: "Emitech not found" }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
