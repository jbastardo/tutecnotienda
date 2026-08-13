import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const emitech = await prisma.supplier.findFirst({
      where: { name: { contains: "emitech", mode: "insensitive" } },
    });

    if (emitech) {
      await prisma.supplierMapping.deleteMany({
        where: { supplierId: emitech.id, key: "sellPrice" },
      });
      await prisma.supplierMapping.create({
        data: {
          supplierId: emitech.id,
          key: "sellPrice",
          columnIndex: 4, // Column E (A=0, B=1, C=2, D=3, E=4)
          transform: "number",
        },
      });
      return NextResponse.json({ success: true, message: `Mapping updated for Emitech (${emitech.id})` });
    } else {
      return NextResponse.json({ success: false, message: "Emitech not found in the database." }, { status: 404 });
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
