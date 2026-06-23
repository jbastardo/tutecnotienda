interface SellibriConfig {
  apiKey: string;
  apiUrl: string;
  storeDomain: string;
}

interface SellibriProductData {
  title: string;
  description?: string;
  price: number;
  cost: number;
  sku?: string;
  vendorName?: string;
  images?: string[];
  tags?: string[];
  status?: "draft" | "active";
}

interface SellibriProductResponse {
  id: number;
  title: string;
  slug: string;
  status: string;
  description: string | null;
  created_at: string;
  variants: Array<{
    id: number;
    price: string;
    cost: string;
    sku: string | null;
  }>;
  error?: string;
}

let config: SellibriConfig = {
  apiKey: process.env.SELLIBRI_API_KEY || "",
  apiUrl: process.env.SELLIBRI_API_URL || "",
  storeDomain: process.env.SELLIBRI_STORE_DOMAIN || "",
};

export function getStoreDomain(): string {
  // Preferir extraer el dominio de la API URL (mas confiable)
  if (config.apiUrl) {
    try { return new URL(config.apiUrl).hostname; } catch {}
  }
  // Fallback a storeDomain si no es el placeholder default
  if (config.storeDomain && !config.storeDomain.includes("tutienda.com")) {
    return config.storeDomain;
  }
  return "tutecnotienda.com";
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

function getBaseUrl(): string {
  if (config.apiUrl) return config.apiUrl.replace(/\/+$/, "");
  if (config.storeDomain) {
    const domain = config.storeDomain.replace(/\/+$/, "").replace(/^https?:\/\//, "");
    return `https://${domain}/api/v1`;
  }
  return "";
}

function getAlternativeUrls(): string[] {
  const urls: string[] = [];
  const base = getBaseUrl();
  if (base) urls.push(base);

  if (config.storeDomain) {
    const domain = config.storeDomain.replace(/\/+$/, "").replace(/^https?:\/\//, "");
    const name = domain.split(".")[0];

    urls.push(`https://${name}.tiendasellibri.com/api/v1`);
    urls.push(`https://${name}.vendabo.com/api/v1`);
    urls.push(`https://${name}.tiendasellibri.com/api`);
    urls.push(`https://${name}.vendabo.com/api`);
    urls.push(`https://api.tiendasellibri.com/api/v1`);
    urls.push(`https://api.sellibri.com/v1`);
  }

  return [...new Set(urls)];
}

function headers(): Record<string, string> {
  return {
    "X-Api-Key": config.apiKey,
    "Content-Type": "application/json",
  };
}

export function configureSellibri(cfg: Partial<SellibriConfig>) {
  config = { ...config, ...cfg };
}

export function isConfigured(): boolean {
  return !!config.apiKey && !!(getBaseUrl());
}

export async function searchProductBySku(sku: string) {
  if (!isConfigured()) return null;
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(
      `${baseUrl}/variants?q[sku_eq]=${encodeURIComponent(sku)}`,
      { headers: headers() }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (data.variants?.length > 0) {
      return data.variants[0];
    }
    return null;
  } catch (e) {
    console.error("[Sellibri] Error buscando SKU:", e);
    return null;
  }
}

export async function createProduct(
  product: SellibriProductData
): Promise<SellibriProductResponse | null> {
  if (!isConfigured()) {
    console.log("[Sellibri] No configurado - saltando creacion");
    return null;
  }

  const baseUrl = getBaseUrl();

  const imagesAttributes = (product.images || []).map((url, idx) => ({
    remote_url: url,
    position: idx + 1,
    alt: product.title,
  }));

  const body: Record<string, unknown> = {
    product: {
      title: product.title,
      description: product.description || "",
      status: product.status || "draft",
      vendor_name: product.vendorName || undefined,
      tag_names: product.tags || [],
      taxon_ids: process.env.SELLIBRI_DEFAULT_TAXON_ID ? [parseInt(process.env.SELLIBRI_DEFAULT_TAXON_ID)] : undefined,
      master_attributes: {
        price: String(product.price),
        cost: String(product.cost),
        sku: product.sku || undefined,
        track_inventory: true,
        images_attributes: imagesAttributes.length > 0 ? imagesAttributes : undefined,
      },
    },
  };

  console.log(`[Sellibri] Creando producto: ${product.title}`);

  try {
    const res = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[Sellibri] Error creando producto:", JSON.stringify(data));
      return null;
    }

    const masterVariant = data.product?.all_variants?.find(
      (v: { is_master: boolean }) => v.is_master
    );

    return {
      id: data.product?.id || 0,
      title: data.product?.title || product.title,
      slug: data.product?.slug || "",
      status: data.product?.status || "draft",
      description: data.product?.description || null,
      created_at: data.product?.created_at || "",
      variants: masterVariant
        ? [
            {
              id: masterVariant.id,
              price: masterVariant.price,
              cost: masterVariant.cost,
              sku: masterVariant.sku,
            },
          ]
        : [],
    };
  } catch (e) {
    console.error("[Sellibri] Error de conexion:", e);
    return null;
  }
}

export async function updateProductVariant(
  variantId: number,
  updates: {
    price?: number;
    cost?: number;
    sku?: string;
    available?: number;
    stockLocationId?: number;
  }
): Promise<boolean> {
  if (!isConfigured()) return false;

  const baseUrl = getBaseUrl();

  const variantData: Record<string, unknown> = {};

  if (updates.price !== undefined) variantData.price = String(updates.price);
  if (updates.cost !== undefined) variantData.cost = String(updates.cost);
  if (updates.sku !== undefined) variantData.sku = updates.sku;

  if (updates.available !== undefined) {
    variantData.stock_items_attributes = [
      {
        stock_location_id: updates.stockLocationId || parseInt(process.env.SELLIBRI_STOCK_LOCATION_ID || "1704") || 1704,
        available: updates.available,
      },
    ];
  }

  try {
    const res = await fetch(`${baseUrl}/variants/${variantId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ variant: variantData }),
    });

    return res.ok;
  } catch (e) {
    console.error("[Sellibri] Error actualizando variante:", e);
    return false;
  }
}

export async function searchProductImages(
  query: string
): Promise<string[]> {
  // Usamos Google Custom Search o Unsplash para buscar imagenes
  // Por ahora retornamos vacio - se implementara segun disponibilidad
  console.log(`[Sellibri] Buscando imagenes para: ${query}`);

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          query
        )}&per_page=3&client_id=${unsplashKey}`
      );
      const data = await res.json();
      return (data.results || []).map(
        (r: { urls: { regular: string } }) => r.urls.regular
      );
    } catch {
      // fallback
    }
  }

  return [];
}

export async function searchOrGenerateDescription(
  name: string
): Promise<string> {
  return `<p>${name}</p><p>Producto importado via Tutecnotienda. Consulte disponibilidad y tiempo de entrega.</p>`;
}

export async function publishProduct(productId: string): Promise<boolean> {
  console.log(`[Sellibri] Publicando producto ID: ${productId}`);
  return true;
}

export interface ImportedProduct {
  sellibriId: number;
  title: string;
  slug: string;
  status: string;
  description: string | null;
  price: number;
  cost: number;
  sku: string | null;
  variantId: number;
  images: string[];
}

async function findWorkingUrl(): Promise<string | null> {
  const urls = getAlternativeUrls();
  for (const url of urls) {
    try {
      const res = await fetch(`${url}/products?per_page=1&page=1`, {
        headers: headers(),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith("{")) return url;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchAllProducts(
  customConfig?: Partial<SellibriConfig>,
  onProgress?: (page: number, total: number) => void
): Promise<{ products: ImportedProduct[]; error?: string }> {
  const cfg = customConfig ? { ...config, ...customConfig } : config;
  
  if (!cfg.apiKey) {
    return { products: [], error: "API key no configurada" };
  }

  const baseUrl = cfg.apiUrl ? cfg.apiUrl.replace(/\/+$/, "") : getBaseUrl();
  
  const headersFn = customConfig ? () => ({
    "X-Api-Key": cfg.apiKey,
    "Content-Type": "application/json",
  }) : headers;

  console.log(`[Sellibri] Usando API: ${baseUrl}`);
  const allProducts: ImportedProduct[] = [];
  let page = 1;

  try {
    while (true) {
      await new Promise((r) => setTimeout(r, 300));

      const url = `${baseUrl}/products?per_page=50&page=${page}`;
      console.log(`[Sellibri] Fetching ${url}`);

      let res: Response;
      try {
        res = await fetch(url, { headers: headersFn() });
      } catch (e) {
        return { products: [], error: `Error de conexion: ${e}. URL: ${url}` };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          products: allProducts,
          error: `HTTP ${res.status} en pagina ${page}: ${text.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      const products = data.products || [];

      for (const p of products) {
        const variants = p.all_variants || [];
        // Master variant always has $0, use first non-master with real data
        const dataVariant =
          variants.find((v: { is_master: boolean; price: string }) => !v.is_master && parseFloat(v.price) > 0) ||
          variants.find((v: { is_master: boolean }) => !v.is_master) ||
          variants[0];

        const images: string[] = variants
          .flatMap((v: { images?: Array<{ image?: string }> }) => v.images || [])
          .map((img: { image?: string }) => img.image || "")
          .filter((url: string) => !!url);

        const price = dataVariant ? Number(dataVariant.price) || 0 : 0;
        const cost = dataVariant ? Number(dataVariant.cost) || 0 : 0;

        allProducts.push({
          sellibriId: p.id,
          title: p.title || "",
          slug: p.slug || "",
          status: p.status || "active",
          description: null,
          price,
          cost,
          sku: dataVariant?.sku || null,
          variantId: dataVariant?.id || 0,
          images: [...new Set(images)],
        });
      }

      const meta = data.meta || {};
      const totalPages = meta.total_pages || 1;
      onProgress?.(page, totalPages);

      if (page >= totalPages) break;
      page++;
    }
  } catch (e) {
    return { products: allProducts, error: `Error inesperado: ${e}` };
  }

  return { products: allProducts };
}

export async function testConnection(): Promise<{ ok: boolean; error?: string; productCount?: number; url?: string; tried?: string[] }> {
  if (!isConfigured()) {
    return { ok: false, error: "No configurado" };
  }

  const urls = getAlternativeUrls();
  const tried: string[] = [];

  for (const baseUrl of urls) {
    const fullUrl = `${baseUrl}/products?per_page=1&page=1`;
    tried.push(fullUrl);
    try {
      const res = await fetch(fullUrl, {
        headers: headers(),
      });

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        if (text.startsWith("{")) {
          return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, url: baseUrl, tried };
        }
        continue;
      }

      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        return {
          ok: true,
          productCount: data.meta?.total_count || (data.products || []).length,
          url: baseUrl,
          tried,
        };
      }

      continue;
    } catch {
      continue;
    }
  }

  return { ok: false, error: "Ninguna URL funciono. Revisa el panel de Sellibri > Ajustes > API para la URL correcta.", tried };
}
