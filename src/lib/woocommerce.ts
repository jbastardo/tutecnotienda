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
