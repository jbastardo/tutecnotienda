import type { ParsedProduct } from "./excel-parser";

export interface FilteredProduct extends ParsedProduct {
  sellPrice: number;
  profit: number;
  margin: number;
  selected: boolean;
  available?: number;
}

export const DEFAULT_MARGIN = 0.4;
export const MIN_PROFIT_THRESHOLD = 100;

export function calculateProduct(
  product: ParsedProduct,
  margin: number = DEFAULT_MARGIN
): FilteredProduct {
  const sellPrice = product.cost * (1 + margin);
  const profit = sellPrice - product.cost;

  return {
    ...product,
    sellPrice: Math.round(sellPrice * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    margin,
    selected: profit > MIN_PROFIT_THRESHOLD,
  };
}

export function filterProducts(
  products: ParsedProduct[],
  margin: number = DEFAULT_MARGIN,
  threshold: number = MIN_PROFIT_THRESHOLD
): FilteredProduct[] {
  return products
    .map((p) => calculateProduct(p, margin))
    .filter((p) => p.profit > threshold);
}

export function processPriceList(
  products: ParsedProduct[],
  margin: number = DEFAULT_MARGIN
): FilteredProduct[] {
  return products
    .map((p) => calculateProduct(p, margin))
    .sort((a, b) => b.profit - a.profit);
}
