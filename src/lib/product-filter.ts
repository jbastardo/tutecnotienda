import type { ParsedProduct } from "./excel-parser";

export interface FilteredProduct extends ParsedProduct {
  sellPrice: number;
  profit: number;
  margin: number;
  selected: boolean;
}

export const DEFAULT_MARGIN = 0.4;
export const MIN_PROFIT_THRESHOLD = 80;

export interface CalculationConfig {
  margin?: number;
  minProfit?: number;
  useSuggestedPrice?: boolean;
}

export function calculateProduct(
  product: ParsedProduct,
  config?: CalculationConfig
): FilteredProduct {
  const margin = config?.margin ?? DEFAULT_MARGIN;
  const minProfit = config?.minProfit ?? MIN_PROFIT_THRESHOLD;
  const useSuggestedPrice = config?.useSuggestedPrice ?? true;

  // Use explicit sellPrice if provided AND useSuggestedPrice is true
  const sellPrice = (useSuggestedPrice && product.sellPrice)
    ? product.sellPrice
    : product.cost * (1 + margin);
  const profit = sellPrice - product.cost;

  return {
    ...product,
    sellPrice: Math.round(sellPrice * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    margin,
    selected: profit >= minProfit,
  };
}

export function filterProducts(
  products: ParsedProduct[],
  config?: CalculationConfig
): FilteredProduct[] {
  const minProfit = config?.minProfit ?? MIN_PROFIT_THRESHOLD;
  return products
    .map((p) => calculateProduct(p, config))
    .filter((p) => p.profit >= minProfit);
}

export function processPriceList(
  products: ParsedProduct[],
  config?: CalculationConfig
): FilteredProduct[] {
  return products
    .map((p) => calculateProduct(p, config))
    .sort((a, b) => b.profit - a.profit);
}
