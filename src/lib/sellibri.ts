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

function getBaseUrl(): string {
  if (config.apiUrl) return config.apiUrl.replace(/\/+$/, "");
  if (config.storeDomain) {
    const domain = config.storeDomain.replace(/\/+$/, "");
    return `https://${domain}/api/v1`;
  }
  return "";
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
        stock_location_id: updates.stockLocationId || 1,
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

export async function fetchAllProducts(
  onProgress?: (page: number, total: number) => void
): Promise<{ products: ImportedProduct[]; error?: string }> {
  if (!isConfigured()) {
    return { products: [], error: "Sellibri no configurado. Revisa SELLIBRI_API_KEY y SELLIBRI_STORE_DOMAIN" };
  }

  const baseUrl = getBaseUrl();
  const allProducts: ImportedProduct[] = [];
  let page = 1;

  try {
    while (true) {
      await new Promise((r) => setTimeout(r, 300));

      const url = `${baseUrl}/products?page=${page}`;
      console.log(`[Sellibri] Fetching ${url}`);

      let res: Response;
      try {
        res = await fetch(url, { headers: headers() });
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
        const masterVariant = (p.all_variants || []).find(
          (v: { is_master: boolean }) => v.is_master
        );
        const images: string[] = (p.all_variants || [])
          .flatMap((v: { images?: Array<{ image?: string }> }) => v.images || [])
          .map((img: { image?: string }) => img.image || "")
          .filter((url: string) => !!url);

        allProducts.push({
          sellibriId: p.id,
          title: p.title || "",
          slug: p.slug || "",
          status: p.status || "active",
          description: null,
          price: masterVariant ? parseFloat(masterVariant.price) || 0 : 0,
          cost: masterVariant ? parseFloat(masterVariant.cost) || 0 : 0,
          sku: masterVariant?.sku || null,
          variantId: masterVariant?.id || 0,
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

export async function testConnection(): Promise<{ ok: boolean; error?: string; productCount?: number }> {
  if (!isConfigured()) {
    return { ok: false, error: "No configurado" };
  }

  const baseUrl = getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/products?page=1`, {
      headers: headers(),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      ok: true,
      productCount: data.meta?.total_count || (data.products || []).length,
    };
  } catch (e) {
    return { ok: false, error: `Error: ${e}` };
  }
}
