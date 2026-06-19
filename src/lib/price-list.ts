import { prisma } from "./prisma";
import { parseExcel } from "./excel-parser";
import { processPriceList, DEFAULT_MARGIN } from "./product-filter";
import type { Prisma } from "@prisma/client";

export async function processUploadedFile(
  supplierId: string,
  fileName: string,
  buffer: ArrayBuffer
) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { mappings: true },
  });

  if (!supplier) {
    throw new Error("Proveedor no encontrado");
  }

  if (supplier.mappings.length === 0) {
    throw new Error(
      "El proveedor no tiene mapeo de columnas configurado. Configuralo primero."
    );
  }

  const { products, errors } = parseExcel(buffer, supplier.mappings);

  if (errors.some((e) => e.includes("no encontrada"))) {
    throw new Error(errors.join("; "));
  }

  const processedProducts = processPriceList(products, DEFAULT_MARGIN);

  const priceList = await prisma.priceList.create({
    data: {
      supplierId,
      fileName,
      status: "processing",
      totalRows: processedProducts.length,
    },
  });

  const productData = processedProducts.map((p) => ({
    priceListId: priceList.id,
    sku: p.sku || null,
    name: p.name,
    description: p.description || null,
    cost: p.cost,
    sellPrice: p.sellPrice,
    profit: p.profit,
    margin: p.margin,
    selected: p.selected,
    rawData: p.rawData as unknown as Prisma.InputJsonValue,
  }));

  await prisma.priceListProduct.createMany({ data: productData });

  const selectedCount = processedProducts.filter((p) => p.selected).length;

  await prisma.priceList.update({
    where: { id: priceList.id },
    data: { status: "processed", selectedCount },
  });

  return {
    priceListId: priceList.id,
    totalRows: processedProducts.length,
    selectedCount,
    errors,
  };
}
