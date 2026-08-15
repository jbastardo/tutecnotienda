import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

// The @woocommerce/woocommerce-rest-api package doesn't have default export properly typed sometimes
const api = typeof WooCommerceRestApi === "function" ? WooCommerceRestApi : (WooCommerceRestApi as any).default;

export const woocommerce = new api({
  url: process.env.WOOCOMMERCE_URL || "https://tutecnotienda.com",
  consumerKey: process.env.WOOCOMMERCE_KEY || "ck_...",
  consumerSecret: process.env.WOOCOMMERCE_SECRET || "cs_...",
  version: "wc/v3",
});

export async function createWooProduct(data: any) {
  try {
    const response = await woocommerce.post("products", data);
    return response.data;
  } catch (error: any) {
    console.error("[WooCommerce] Error creating product:", error.response?.data || error.message);
    throw error;
  }
}

export async function updateWooProduct(productId: number, data: any) {
  try {
    const response = await woocommerce.put(`products/${productId}`, data);
    return response.data;
  } catch (error: any) {
    console.error(`[WooCommerce] Error updating product ${productId}:`, error.response?.data || error.message);
    throw error;
  }
}

export async function getWooProductBySku(sku: string) {
  try {
    const response = await woocommerce.get("products", { sku });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error: any) {
    console.error(`[WooCommerce] Error fetching product by SKU ${sku}:`, error.response?.data || error.message);
    return null;
  }
}

export async function ensureWooCategory(name: string): Promise<number | null> {
  if (!name) return null;
  try {
    // 1. Search if category exists
    const searchRes = await woocommerce.get("products/categories", { search: name });
    if (searchRes.data && searchRes.data.length > 0) {
      // Find exact match (case insensitive)
      const exactMatch = searchRes.data.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
      if (exactMatch) return exactMatch.id;
    }

    // 2. If it doesn't exist, create it
    const createRes = await woocommerce.post("products/categories", { name });
    if (createRes.data && createRes.data.id) {
      return createRes.data.id;
    }
    return null;
  } catch (error: any) {
    console.error(`[WooCommerce] Error ensuring category ${name}:`, error.response?.data || error.message);
    return null;
  }
}
