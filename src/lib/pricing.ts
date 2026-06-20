export interface PricingInput {
  costUsd: number;
  quantity: number;
  paymentMethod: 'bs' | 'cash' | 'binance' | 'divisas';
  profitMargin: number;
  bcvRate: number;
  promedioRate: number;
}

export interface PricingResult {
  costUsd: number;
  costBs: number;
  salePriceUsd: number;
  salePriceBs: number;
  ivaAmount: number;
  subtotalBs: number;
  subtotalUsd: number;
  totalBs: number;
  totalUsd: number;
  bcvEquivalent: number;
  utilidadBs: number;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const { costUsd, quantity, paymentMethod, profitMargin, bcvRate, promedioRate } = input;

  const marginDecimal = profitMargin / 100;
  const salePriceUsd = costUsd / (1 - marginDecimal);

  if (paymentMethod === 'bs') {
    const costBs = costUsd * promedioRate;
    const salePriceBs = salePriceUsd * promedioRate;
    const ivaAmount = salePriceBs * 0.16;
    const totalBs = salePriceBs + ivaAmount;

    return {
      costUsd: costUsd * quantity,
      costBs: costBs * quantity,
      salePriceUsd,
      salePriceBs,
      ivaAmount,
      subtotalBs: salePriceBs * quantity,
      subtotalUsd: salePriceUsd * quantity,
      totalBs: totalBs * quantity,
      totalUsd: salePriceUsd * quantity,
      bcvEquivalent: salePriceUsd * bcvRate * quantity,
      utilidadBs: (salePriceBs - costBs) * quantity,
    };
  }

  return {
    costUsd: costUsd * quantity,
    costBs: 0,
    salePriceUsd,
    salePriceBs: 0,
    ivaAmount: 0,
    subtotalBs: 0,
    subtotalUsd: salePriceUsd * quantity,
    totalBs: 0,
    totalUsd: salePriceUsd * quantity,
    bcvEquivalent: 0,
    utilidadBs: 0,
  };
}

export function formatBs(amount: number | null | undefined): string {
  const num = amount ?? 0;
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsd(amount: number | null | undefined): string {
  const num = amount ?? 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
