import * as XLSX from "xlsx";

export interface ExcelRow {
  [key: string]: string | number | undefined;
}

export interface ParsedProduct {
  name: string;
  sku?: string;
  description?: string;
  brand?: string;
  category?: string;
  cost: number;
  sellPrice?: number;
  comparePrice?: number;
  available?: number;
  imageUrl?: string;
  barcode?: string;
  tags?: string;
  weight?: number;
  rawData: ExcelRow;
}

export interface SupplierMapping {
  key: string;
  columnName?: string | null;
  columnIndex?: number | null;
  sheetName?: string | null;
  skipRows: number;
  transform?: string | null;
}

function findColumnIndex(
  headers: string[],
  mapping: SupplierMapping
): number | null {
  if (mapping.columnIndex !== null && mapping.columnIndex !== undefined) {
    return mapping.columnIndex;
  }
  if (mapping.columnName) {
    const target = mapping.columnName.trim().toLowerCase();
    // First try exact match
    let idx = headers.findIndex(
      (h) => h.trim().toLowerCase() === target
    );
    if (idx !== -1) return idx;
    // Try without special chars
    idx = headers.findIndex(
      (h) => h.trim().toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, "") === target.replace(/[^a-z0-9áéíóúñ ]/g, "")
    );
    if (idx !== -1) return idx;
    // Try contains
    idx = headers.findIndex(
      (h) => h.trim().toLowerCase().includes(target) || target.includes(h.trim().toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return null;
}

function parseValue(
  value: XLSX.CellObject | string | number | undefined,
  transform?: string | null
): string | number {
  if (value === undefined || value === null) return "";
  
  // If it's already a number
  if (typeof value === "number") {
    return transform === "number" || transform === "currency" ? value : String(value);
  }
  
  if (typeof value === "string") {
    // Only try to parse as number if transform is number/currency
    if (transform === "number" || transform === "currency") {
      const cleaned = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return value.trim();
  }
  
  if (typeof value === "object" && "w" in value) {
    const str = String(value.w ?? value.v ?? "");
    if (transform === "number" || transform === "currency") {
      const cleaned = str.replace(/[^0-9.,-]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return str.trim();
  }
  return String(value);
}

export function parseExcel(
  buffer: ArrayBuffer,
  mappings: SupplierMapping[]
): { products: ParsedProduct[]; errors: string[]; headers: string[] } {
  const errors: string[] = [];
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetMapping = mappings.find((m) => m.sheetName)?.sheetName;
  const sheetName = sheetMapping || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return { products: [], errors: [`Sheet "${sheetName}" not found`], headers: [] };
  }

  const jsonData = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  if (jsonData.length === 0) {
    return { products: [], errors: ["El archivo Excel esta vacio"], headers: [] };
  }

  const skipRows = mappings[0]?.skipRows || 0;
  const headers = (jsonData[skipRows] as string[]) || [];
  const dataRows = jsonData.slice(skipRows + 1);

  const nameMapping = mappings.find((m) => m.key === "name");
  const skuMapping = mappings.find((m) => m.key === "sku");
  const descMapping = mappings.find((m) => m.key === "description");
  const catMapping = mappings.find((m) => m.key === "category");
  const brandMapping = mappings.find((m) => m.key === "brand");
  const costMapping = mappings.find((m) => m.key === "cost");
  const availMapping = mappings.find((m) => m.key === "available");
  const priceMapping = mappings.find((m) => m.key === "sellPrice");
  const cmpPriceMapping = mappings.find((m) => m.key === "comparePrice");
  const imgMapping = mappings.find((m) => m.key === "imageUrl");
  const barcodeMapping = mappings.find((m) => m.key === "barcode");
  const tagsMapping = mappings.find((m) => m.key === "tags");
  const weightMapping = mappings.find((m) => m.key === "weight");

  const nameIdx = nameMapping ? findColumnIndex(headers, nameMapping) : null;
  const skuIdx = skuMapping ? findColumnIndex(headers, skuMapping) : null;
  const descIdx = descMapping ? findColumnIndex(headers, descMapping) : null;
  const catIdx = catMapping ? findColumnIndex(headers, catMapping) : null;
  const brandIdx = brandMapping ? findColumnIndex(headers, brandMapping) : null;
  const costIdx = costMapping ? findColumnIndex(headers, costMapping) : null;
  const availIdx = availMapping ? findColumnIndex(headers, availMapping) : null;
  const priceIdx = priceMapping ? findColumnIndex(headers, priceMapping) : null;
  const cmpPriceIdx = cmpPriceMapping ? findColumnIndex(headers, cmpPriceMapping) : null;
  const imgIdx = imgMapping ? findColumnIndex(headers, imgMapping) : null;
  const barcodeIdx = barcodeMapping ? findColumnIndex(headers, barcodeMapping) : null;
  const tagsIdx = tagsMapping ? findColumnIndex(headers, tagsMapping) : null;
  const weightIdx = weightMapping ? findColumnIndex(headers, weightMapping) : null;

  if (nameIdx === null) errors.push(`Columna 'name' no encontrada. Headers: ${headers.slice(0, 20).join(", ")}`);
  if (costIdx === null) errors.push(`Columna 'cost' no encontrada. Headers: ${headers.slice(0, 20).join(", ")}`);

  if (nameIdx === null || costIdx === null) {
    return { products: [], errors, headers: headers.map(h => String(h)) };
  }

  const products: ParsedProduct[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row)) continue;

    const rowArr = row as (string | number)[];
    if (rowArr.every((cell) => cell === "" || cell === undefined || cell === null)) {
      continue;
    }

    const name = parseValue(rowArr[nameIdx]);
    const cost = parseValue(rowArr[costIdx], "number");
    const available = availIdx !== null ? parseInt(String(parseValue(rowArr[availIdx], "number"))) || 0 : 0;

    if (!name || (typeof cost === "number" && cost <= 0)) continue;

    const rawData: ExcelRow = {};
    headers.forEach((h, idx) => {
      rawData[h] = rowArr[idx];
    });

    products.push({
      name: String(name),
      sku: skuIdx !== null ? String(parseValue(rowArr[skuIdx])) : undefined,
      description: descIdx !== null ? String(parseValue(rowArr[descIdx])) : undefined,
      brand: brandIdx !== null ? String(parseValue(rowArr[brandIdx])) : undefined,
      category: catIdx !== null ? String(parseValue(rowArr[catIdx])) : undefined,
      cost: typeof cost === "number" ? cost : 0,
      sellPrice: priceIdx !== null ? Number(parseValue(rowArr[priceIdx], "number")) || undefined : undefined,
      comparePrice: cmpPriceIdx !== null ? Number(parseValue(rowArr[cmpPriceIdx], "number")) || undefined : undefined,
      available: available > 0 ? available : undefined,
      imageUrl: imgIdx !== null ? String(parseValue(rowArr[imgIdx])) || undefined : undefined,
      barcode: barcodeIdx !== null ? String(parseValue(rowArr[barcodeIdx])) || undefined : undefined,
      tags: tagsIdx !== null ? String(parseValue(rowArr[tagsIdx])) || undefined : undefined,
      weight: weightIdx !== null ? Number(parseValue(rowArr[weightIdx], "number")) || undefined : undefined,
      rawData,
    });
  }

  return { products, errors, headers: headers.map(h => String(h)) };
}
