import { prisma } from "./prisma";
import { parseExcel } from "./excel-parser";
import { processPriceList, DEFAULT_MARGIN } from "./product-filter";
import type { Prisma } from "@prisma/client";

import { fetchAllProducts } from "./sellibri";

const ONPROTEC_CONFIG = {
  apiKey: "2uNyT2EUSyBVXx5yhYBS5AFPSbyhQqCp9MdupF3CyUGv6a9JtB1EtQTbwf7P6fqeLHjjAN2Z8uoMfnMrMv9usFMmwffGNTLeU2qP",
  apiUrl: "https://onprotec.com/api/v1",
  storeDomain: "onprotec.com",
};

export async function processUploadedFile(
  supplierId: string,
  fileName: string,
  buffer: ArrayBuffer,
  customMargin?: number
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

  const { products, errors, headers } = parseExcel(buffer, supplier.mappings);

  if (errors.some((e) => e.includes("no encontrada"))) {
    throw new Error(errors.join("; "));
  }

  const margin = customMargin ?? Number(supplier.margin);
  let processedProducts = processPriceList(products, {
    margin,
    minProfit: Number(supplier.minProfit),
    useSuggestedPrice: supplier.useSuggestedPrice,
  });

  // Fetch Onprotec products to filter out matches (by SKU/Modelo)
  try {
    const onprotecRes = await fetchAllProducts(ONPROTEC_CONFIG);
    if (onprotecRes.products && onprotecRes.products.length > 0) {
      const onprotecSkus = new Set(
        onprotecRes.products
          .filter(p => p.sku)
          .map(p => p.sku!.trim().toLowerCase())
      );
      
      const onprotecNames = new Set(
        onprotecRes.products
          .map(p => p.title.trim().toLowerCase())
      );

      processedProducts = processedProducts.map(p => {
        // If profit was > 100, it might be selected. Let's verify against Onprotec.
        if (p.selected) {
           const matchSku = p.sku && onprotecSkus.has(p.sku.trim().toLowerCase());
           // If we don't have SKU, try name matching just in case
           const matchName = onprotecNames.has(p.name.trim().toLowerCase());
           
           if (matchSku || matchName) {
             p.selected = false;
             (p as any).notes = "Rechazado: Ya lo vende Onprotec";
           }
        }
        return p;
      });
    }
  } catch (e) {
    console.error("Error comparando con Onprotec", e);
  }

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
    brand: p.brand || null,
    category: p.category || null,
    cost: p.cost,
    sellPrice: p.sellPrice,
    comparePrice: p.comparePrice || 0,
    profit: p.profit,
    margin: p.margin,
    selected: p.selected,
    available: p.available || 0,
    imageUrl: p.imageUrl || null,
    barcode: p.barcode || null,
    tags: p.tags || null,
    weight: p.weight || null,
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
    headers,
  };
}
