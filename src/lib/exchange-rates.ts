export interface ExchangeRates {
  bcv: number;
  promedio: number;
  lastUpdated: string;
}

const APIS = [
  {
    url: 'https://ve.dolarapi.com/v1/dolares',
    parse: (data: any) => {
      const oficial = data.find((d: any) => d.fuente === 'oficial');
      const paralelo = data.find((d: any) => d.fuente === 'paralelo');
      return {
        bcv: oficial?.promedio || 0,
        promedio: paralelo?.promedio || 0,
        lastUpdated: oficial?.fechaActualizacion || new Date().toISOString(),
      };
    },
  },
  {
    url: 'https://dolar.wrservicios.com/api/rates',
    parse: (data: any) => ({
      bcv: data.bcv?.monto || data.bcv || 0,
      promedio: data.promedio?.monto || data.promedio || 0,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
    }),
  },
];

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  for (const api of APIS) {
    try {
      const response = await fetch(api.url, {
        cache: 'no-store',
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rates = api.parse(data);

      if (rates.bcv > 0 && rates.promedio > 0) {
        return rates;
      }
    } catch (error) {
      console.error(`Error fetching from ${api.url}:`, error);
    }
  }

  console.error('All rate APIs failed');
  return {
    bcv: 0,
    promedio: 0,
    lastUpdated: new Date().toISOString(),
  };
}
