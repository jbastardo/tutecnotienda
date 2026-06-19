"use client";

import { useEffect, useState } from "react";
import { Upload, Search, RefreshCw, Trash2, ExternalLink, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  cost: number;
  sellPrice: number;
  profit: number;
  synced: boolean;
  sellibriId: string | null;
  sellibriUrl: string | null;
  status: string;
  supplier: { id: string; name: string; slug: string } | null;
  supplierId: string | null;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  slug: string;
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "synced" | "pending">("all");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [importSupplierId, setImportSupplierId] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then((d) => setSuppliers(Array.isArray(d) ? d : []));
  }, [filter]);

  const fetchProducts = async () => {
    setLoading(true);
    const searchParams = new URLSearchParams();
    if (filter === "synced") searchParams.set("synced", "true");
    if (filter === "pending") searchParams.set("synced", "false");
    const res = await fetch(`/api/productos?${searchParams}`);
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const syncToSellibri = async (productId: string) => {
    setSyncing(productId);
    setMessage("");
    const res = await fetch("/api/sellibri/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Producto sincronizado con Sellibri");
      fetchProducts();
    } else {
      setMessage(data.error || "Error al sincronizar");
    }
    setSyncing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este producto?")) return;
    await fetch("/api/productos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchProducts();
  };

  const updateSupplier = async (productId: string, newSupplierId: string) => {
    const res = await fetch("/api/productos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: productId, supplierId: newSupplierId || null }),
    });
    if (res.ok) fetchProducts();
  };

  const handleImport = async () => {
    setImporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/sellibri/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: importSupplierId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          `Importacion: ${data.imported} nuevos, ${data.skipped} ya existian (total: ${data.total})`
        );
        setShowImport(false);
        fetchProducts();
      } else {
        setMessage(data.error || "Error al importar");
      }
    } catch {
      setMessage("Error de conexion");
    }
    setImporting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Productos seleccionados para publicar en tu tienda
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Importar de Sellibri
          </button>
        </div>
      </div>

      {showImport && (
        <div className="mt-4 rounded-xl border bg-white p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            Importar productos existentes de Sellibri
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Trae todos los productos que ya tienes publicados. Opcional: asigna un proveedor.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor (opcional)
              </label>
              <select
                value={importSupplierId}
                onChange={(e) => setImportSupplierId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {importing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {importing ? "Importando..." : "Importar"}
            </button>
          </div>
          {suppliers.length === 0 && (
            <p className="mt-3 text-xs text-amber-600">
              No hay proveedores.{" "}
              <a href="/proveedores/nuevo" className="underline">
                Crea uno primero
              </a>
              .
            </p>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.includes("Error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {(["all", "pending", "synced"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border"
            }`}
          >
            {f === "all" ? "Todos" : f === "pending" ? "Pendientes" : "Sincronizados"}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500">
          {products.length} productos
        </span>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-white p-12 text-center">
          <p className="text-gray-500">
            No hay productos. Sube una lista de precios para empezar.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    {p.sku && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
                        {p.sku}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.synced
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {p.synced ? "Sincronizado" : "Pendiente"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">Costo: </span>
                      <span className="font-medium text-gray-700">
                        {formatCurrency(Number(p.cost))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Venta: </span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(Number(p.sellPrice))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Utilidad: </span>
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(Number(p.profit))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-gray-400">Proveedor:</span>
                    <select
                      value={p.supplierId || ""}
                      onChange={(e) => updateSupplier(p.id, e.target.value)}
                      className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
                    >
                      <option value="">Sin proveedor</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString("es-VE")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {!p.synced && (
                    <button
                      onClick={() => syncToSellibri(p.id)}
                      disabled={syncing === p.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {syncing === p.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Sincronizar
                    </button>
                  )}
                  {p.sellibriUrl && (
                    <a
                      href={p.sellibriUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
