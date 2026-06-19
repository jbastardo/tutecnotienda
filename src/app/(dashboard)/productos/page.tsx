"use client";

import { useEffect, useState } from "react";
import { Upload, Search, RefreshCw, Trash2, ExternalLink } from "lucide-react";
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
  supplier: { id: string; name: string; slug: string };
  createdAt: string;
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "synced" | "pending">("all");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProducts();
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Productos seleccionados para publicar en tu tienda
          </p>
        </div>
      </div>

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

                  <div className="mt-1 text-xs text-gray-400">
                    Proveedor: {p.supplier?.name} &middot;{" "}
                    {new Date(p.createdAt).toLocaleDateString("es-VE")}
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
