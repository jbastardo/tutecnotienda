"use client";

import { useEffect, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, X, ArrowRight, Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  slug: string;
}

interface PriceListProduct {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  cost: number;
  sellPrice: number;
  profit: number;
  selected: boolean;
  available: number;
  imageUrl: string | null;
}

interface PriceList {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  selectedCount: number;
  createdAt: string;
  products: PriceListProduct[];
  supplier: { name: string };
}

export default function SubirListaPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [margin, setMargin] = useState("40");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then(setSuppliers);
  }, []);

  useEffect(() => {
    if (priceList) {
      const autoSelected = priceList.products
        .filter((p) => p.selected)
        .map((p) => p.id);
      setSelectedIds(new Set(autoSelected));
    }
  }, [priceList]);

  const toggleProduct = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleUpload = async () => {
    if (!file || !selectedSupplier) return;
    setUploading(true);
    setError("");
    setPriceList(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplierId", selectedSupplier);
    formData.append("margin", margin);

    const res = await fetch("/api/subir-lista", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      setPriceList(data);
    } else {
      setError(data.error || "Error al procesar el archivo");
    }

    setUploading(false);
  };

  const handleCreateProducts = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);
    setMessage("");

    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage(`${data.length} productos creados exitosamente`);
      setPriceList(null);
      setFile(null);
    } else {
      setMessage(data.error || "Error al crear productos");
    }

    setCreating(false);
  };

  const supplier = suppliers.find((s) => s.id === selectedSupplier);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Subir Lista de Precios</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sube un archivo Excel de tu proveedor para procesar productos
      </p>

      {!priceList ? (
        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Selecciona un proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.slug})
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  No hay proveedores.{" "}
                  <a href="/proveedores/nuevo" className="underline">
                    Crea uno primero
                  </a>
                  .
                </p>
              )}
            </div>

            {supplier && supplier.id !== undefined && (
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                <strong>{supplier.name}</strong>: Se procesara con el mapeo de
                columnas configurado (nombre, costo, SKU, etc.)
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo Excel
              </label>
              <div className="flex items-center gap-3">
                <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 hover:border-blue-400 hover:bg-blue-50/50">
                  <FileSpreadsheet className="h-8 w-8 text-gray-400" />
            <div>
                    <p className="text-sm font-medium text-gray-700">
                      {file ? file.name : "Seleccionar archivo"}
                    </p>
                    <p className="text-xs text-gray-400">
                      .xlsx, .xls o .csv
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || !selectedSupplier || uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Procesar lista
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Resultado del procesamiento
                </h2>
                <p className="text-sm text-gray-500">
                  {priceList.fileName} &middot; {priceList.totalRows} productos
                  encontrados &middot;{" "}
                  <span className="font-semibold text-green-600">
                    {priceList.selectedCount} con utilidad &gt; $100
                  </span>
                </p>
              </div>
              <button
                onClick={() => setPriceList(null)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="w-12 px-4 py-3 text-center">
                      <span className="text-xs font-medium text-gray-500">
                        Sel.
                      </span>
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      Producto
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">
                      SKU
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">
                      Costo
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">
                      Venta (+40%)
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">
                      Utilidad
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {priceList.products.map((p) => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          isSelected ? "bg-blue-50/50" : ""
                        }`}
                        onClick={() => toggleProduct(p.id)}
                      >
                        <td className="px-4 py-3 text-center">
                          <div
                            className={`mx-auto flex h-5 w-5 items-center justify-center rounded ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "border border-gray-300"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {p.sku || "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(Number(p.cost))}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">
                          {formatCurrency(Number(p.sellPrice))}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span
                            className={
                              Number(p.profit) > 100
                                ? "text-blue-600"
                                : "text-gray-400"
                            }
                          >
                            {formatCurrency(Number(p.profit))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.selected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                              <Check className="h-3 w-3" />
                              &gt; $100
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
                              <X className="h-3 w-3" />
                              No pasa
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-white p-4">
            <div>
              <span className="text-sm text-gray-500">
                {selectedIds.size} producto(s) seleccionado(s) de{" "}
                {priceList.totalRows}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {message && (
                <span
                  className={`text-sm ${
                    message.includes("Error")
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {message}
                </span>
              )}
              <button
                onClick={() => setSelectedIds(new Set(priceList.products.filter((p) => p.selected).map((p) => p.id)))}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Solo automaticos
              </button>
              <button
                onClick={handleCreateProducts}
                disabled={selectedIds.size === 0 || creating}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {creating
                  ? "Creando..."
                  : `Crear ${selectedIds.size} producto(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
