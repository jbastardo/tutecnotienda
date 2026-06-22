interface CachicamoConfig {
  apiToken: string;
  storeId: string;
  baseUrl: string;
}

let config: CachicamoConfig = {
  apiToken: process.env.CACHICAMO_API_TOKEN || "",
  storeId: process.env.CACHICAMO_STORE_ID || "",
  baseUrl: "https://api.cachicamo.app",
};

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    "X-Store-Uuid": config.storeId,
    "Content-Type": "application/json",
  };
}

export function configureCachicamo(cfg: Partial<CachicamoConfig>) {
  config = { ...config, ...cfg };
}

export function isConfigured(): boolean {
  return !!(config.apiToken && config.storeId);
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: false, error: "No configurado" };

  try {
    const res = await fetch(`${config.baseUrl}/products?per_page=1`, {
      headers: headers(),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `Error: ${e}` };
  }
}

export async function fetchProducts(): Promise<any[]> {
  if (!isConfigured()) return [];

  const all: any[] = [];
  let page = 1;

  while (true) {
    await new Promise((r) => setTimeout(r, 300));
    const res = await fetch(`${config.baseUrl}/products?per_page=50&page=${page}`, {
      headers: headers(),
    });
    if (!res.ok) break;

    const data = await res.json();
    const items = data.data || data.products || [];
    all.push(...items);

    const totalPages = data.meta?.last_page || 1;
    if (page >= totalPages || items.length === 0) break;
    page++;
  }

  return all;
}

export async function createProduct(product: {
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  description?: string;
  barcode?: string;
  stock?: number;
}): Promise<any | null> {
  if (!isConfigured()) return null;

  try {
    const res = await fetch(`${config.baseUrl}/products`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: product.name,
        sku: product.sku || undefined,
        base_price: product.price,
        cost: product.cost || undefined,
        description: product.description || undefined,
        barcode: product.barcode || undefined,
        stock: product.stock || 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Cachicamo] Error creando producto:", text.slice(0, 300));
      return null;
    }

    return res.json();
  } catch (e) {
    console.error("[Cachicamo] Error:", e);
    return null;
  }
}

export async function updateProduct(
  id: string,
  updates: { price?: number; cost?: number; stock?: number; name?: string }
): Promise<boolean> {
  if (!isConfigured()) return false;

  try {
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.price !== undefined) body.base_price = updates.price;
    if (updates.cost !== undefined) body.cost = updates.cost;
    if (updates.stock !== undefined) body.stock = updates.stock;

    const res = await fetch(`${config.baseUrl}/products/${id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch (e) {
    console.error("[Cachicamo] Error:", e);
    return false;
  }
}
