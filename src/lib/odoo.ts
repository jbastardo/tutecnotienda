import * as xmlrpc from "xmlrpc";

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

const odooConfig: OdooConfig = {
  url: process.env.ODOO_URL || "https://www.onprotec.shop",
  db: process.env.ODOO_DB || "binaural-dev-onprotec-16-release-8815487",
  username: process.env.ODOO_USERNAME || "juan@onprotec.com",
  apiKey: process.env.ODOO_API_KEY || "2a7885a7768c6543517cfd74f0a32a8241a9ba72",
};

function createClient(path: string): xmlrpc.Client {
  const url = new URL(path, odooConfig.url);
  if (url.protocol === "https:") {
    return xmlrpc.createSecureClient({
      host: url.hostname,
      port: 443,
      path: url.pathname,
    });
  }
  return xmlrpc.createClient({
    host: url.hostname,
    port: 80,
    path: url.pathname,
  });
}

function call(client: xmlrpc.Client, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: any, value: any) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

let cachedUid: number | null = null;

async function authenticate(): Promise<number> {
  if (cachedUid) return cachedUid;
  const common = createClient("/xmlrpc/2/common");
  const version = await call(common, "version", []);
  const uid = await call(common, "authenticate", [
    odooConfig.db,
    odooConfig.username,
    odooConfig.apiKey,
    {},
  ]);
  if (!uid || uid === false) throw new Error("Autenticacion Odoo fallida");
  cachedUid = uid;
  return uid;
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const uid = await authenticate();
    return { ok: !!uid };
  } catch (e: any) {
    return { ok: false, error: e.message || "Error Odoo" };
  }
}

export interface OdooProduct {
  id: number;
  name: string;
  default_code: string;
  list_price: number;
  price_with_tax: number;
  qty_available: number;
}

export async function fetchProducts(): Promise<OdooProduct[]> {
  const uid = await authenticate();
  const models = createClient("/xmlrpc/2/object");

  const ids = await call(models, "execute_kw", [
    odooConfig.db,
    uid,
    odooConfig.apiKey,
    "product.template",
    "search",
    [[["sale_ok", "=", true], ["type", "=", "product"]]],
  ]);

  if (!ids || ids.length === 0) return [];

  const products = await call(models, "execute_kw", [
    odooConfig.db,
    uid,
    odooConfig.apiKey,
    "product.template",
    "read",
    [ids],
    { fields: ["name", "default_code", "list_price", "qty_available"] },
  ]);

  return (products || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    default_code: p.default_code || "",
    list_price: p.list_price || 0,
    price_with_tax: p.list_price * 1.16,
    qty_available: p.qty_available || 0,
  }));
}

export async function getProductPrices(sku: string): Promise<any> {
  try {
    const uid = await authenticate();
    const models = createClient("/xmlrpc/2/object");

    // Find product by SKU
    const ids = await call(models, "execute_kw", [
      odooConfig.db, uid, odooConfig.apiKey,
      "product.product",
      "search",
      [[["default_code", "=", sku]]],
    ]);

    if (!ids || ids.length === 0) return { error: "SKU no encontrado" };

    // Read product with all price fields
    const products = await call(models, "execute_kw", [
      odooConfig.db, uid, odooConfig.apiKey,
      "product.product",
      "read",
      [ids],
      { fields: ["name", "default_code", "list_price", "lst_price", "standard_price", "qty_available"] },
    ]);

    const p = products[0];
    return {
      sku: p.default_code,
      name: p.name,
      list_price: p.list_price || p.lst_price,
      standard_price: p.standard_price,
      qty_available: p.qty_available,
    };
  } catch (e: any) {
    return { error: e.message || "Error" };
  }
}
