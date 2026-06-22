interface TecnotizacionConfig {
  apiUrl: string;
  apiKey: string;
}

let config: TecnotizacionConfig = {
  apiUrl: process.env.TECNOTIZACION_URL || "https://tecnotizacion-production.up.railway.app",
  apiKey: process.env.API_KEY || process.env.TECNOTIZACION_API_KEY || "",
};

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-internal-key": config.apiKey,
  };
}

export function isConfigured(): boolean {
  return !!config.apiUrl && !!config.apiKey;
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${config.apiUrl}/api/health`, {
      headers: headers(),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: `${e}` };
  }
}

export async function fetchProducts(): Promise<any[]> {
  const res = await fetch(`${config.apiUrl}/api/products`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function sendProduct(product: {
  name: string;
  sku?: string;
  costUsd: number;
  description?: string;
  category?: string;
  imageUrl?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${config.apiUrl}/api/products`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: product.name,
        sku: product.sku || undefined,
        costUsd: product.costUsd,
        description: product.description || undefined,
        category: product.category || undefined,
        imageUrl: product.imageUrl || undefined,
        profitMargin: 45,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[Tecnotizacion] Error:", e);
    return false;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${config.apiUrl}/api/products`, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
