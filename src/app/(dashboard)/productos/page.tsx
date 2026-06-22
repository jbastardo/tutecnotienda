"use client";

import { useEffect, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, X, ArrowRight, Loader2, Download, LayoutGrid, List, Package, Search, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculatePricing, formatBs, formatUsd } from "@/lib/pricing";

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
  const [rates, setRates] = useState({ bcv: 0, promedio: 0, lastUpdated: "" });
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [showCatalog, setShowCatalog] = useState(true);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then(setSuppliers);
    fetch("/api/tasas")
      .then((r) => r.json())
      .then((d) => { if (d.bcv > 0) setRates(d); })
      .catch(() => {});
  }, []);

  const fetchCatalog = async () => {
    setCatalogLoading(true);
    const res = await fetch("/api/productos?synced=true");
    const data = await res.json();
    setCatalogProducts(Array.isArray(data) ? data : []);
    setCatalogLoading(false);
  };

  useEffect(() => {
    if (showCatalog) fetchCatalog();
  }, [showCatalog]);

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

    const ids = Array.from(selectedIds);

    // Create in local DB
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Error al crear productos");
      setCreating(false);
      return;
    }

    // Sync to Sellibri
    let synced = 0;
    for (const product of data) {
      const plp = priceList?.products.find(p => p.id === product.sourceId || p.name === product.name);
      try {
        const syncRes = await fetch("/api/sellibri/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            available: plp?.available || 0,
          }),
          credentials: "include",
        });
        if (syncRes.ok) synced++;
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }

    setMessage(`${data.length} creados. ${synced} sincronizados a la web.`);
    setPriceList(null);
    setFile(null);
    setCreating(false);
  };

  const handleUpdateStock = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);
    setMessage("Actualizando precios y stock...");
    let updated = 0;

    for (const id of Array.from(selectedIds)) {
      const plp = priceList?.products.find(p => p.id === id);
      if (!plp?.sku) continue;

      const checkRes = await fetch(`/api/productos?sku=${encodeURIComponent(plp.sku)}`);
      const existing = await checkRes.json();
      
      if (Array.isArray(existing) && existing.length > 0) {
        // Update local product with new cost/price
        await fetch("/api/productos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existing[0].id,
            cost: Number(plp.cost),
            sellPrice: Number(plp.sellPrice),
            profit: Number(plp.profit),
          }),
        });

        // Sync to Sellibri if already synced
        if (existing[0].synced) {
          try {
            const syncRes = await fetch("/api/sellibri/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId: existing[0].id,
                available: plp.available || 0,
              }),
              credentials: "include",
            });
            if (syncRes.ok) updated++;
          } catch {}
        }
      }
      await new Promise(r => setTimeout(r, 350));
    }
    setMessage(`Precios y stock actualizados en ${updated} productos.`);
    setCreating(false);
  };

  const supplier = suppliers.find((s) => s.id === selectedSupplier);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Importa desde Excel o Sellibri, gestiona y sincroniza
      </p>

      {rates.bcv > 0 && (
        <div className="mt-4 flex items-center gap-6 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
          <div>
            <span className="text-blue-800 font-semibold">Tasa BCV:</span>
            <span className="ml-2 text-blue-700">Bs {rates.bcv.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-blue-800 font-semibold">Paralelo:</span>
            <span className="ml-2 text-blue-700">Bs {rates.promedio.toFixed(2)}</span>
          </div>
          <div className="ml-auto text-xs text-blue-500">
            Ej: costo $100 → margen {margin}% → venta ${((100 / (1 - Number(margin)/100))).toFixed(2)} USD → {(100 / (1 - Number(margin)/100) * rates.promedio).toLocaleString('es-VE', {maximumFractionDigits:0})} Bs
          </div>
        </div>
      )}

      {!priceList ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border bg-white p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Importar desde Excel</h2>
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
                Margen de ganancia (%)
              </label>
              <input
                type="number"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
                min="1" max="500" step="0.5"
              />
            </div>

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

        <div className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Importar desde Sellibri</h2>
          <p className="text-sm text-gray-500 mb-3">
            Trae productos que ya tienes publicados en tu tienda online
          </p>
          <button
            onClick={async () => {
              if (!confirm("Esto importara todos los productos de tutecnotienda.com. Continuar?")) return;
              setUploading(true);
              setError("");
              try {
                const res = await fetch("/api/sellibri/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                  credentials: "include",
                });
                const data = await res.json();
                if (res.ok) setError(`Importados: ${data.imported} nuevos, ${data.skipped} existian (${data.total} total)`);
                else setError(data.error || "Error");
              } catch { setError("Error de conexion"); }
              setUploading(false);
            }}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Importar de Sellibri
          </button>
          {error && !error.includes("Columna") && (
            <p className={`mt-2 text-sm ${error.includes("Error") ? "text-red-600" : "text-green-700"}`}>{error}</p>
          )}
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
                {(priceList as any)._headers && (
                  <p className="text-xs text-gray-400 mt-1">
                    Headers: {(priceList as any)._headers.join(" | ")}
                  </p>
                )}
                {(priceList as any)._errors?.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {(priceList as any)._errors.join(" · ")}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  <button
                    onClick={async () => {
                      const skus = priceList.products.filter(p => p.sku).map(p => p.sku);
                      const res = await fetch("/api/productos?notInList=" + skus.join(","));
                      const data = await res.json();
                      setMessage(`${data.length} productos en la web NO estan en esta lista.`);
                    }}
                    className="text-blue-500 hover:underline"
                  >
                    Ver faltantes
                  </button>
                  {" · "}
                  <button
                    onClick={async () => {
                      if (!confirm("Poner stock 0 en la web a todos los productos que NO estan en esta lista?")) return;
                      setCreating(true);
                      setMessage("Poniendo stock 0 a faltantes...");
                      const skus = priceList.products.filter(p => p.sku).map(p => p.sku);
                      const res = await fetch("/api/sellibri/bulk-stock-zero", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ excludeSkus: skus }),
                        credentials: "include",
                      });
                      const data = await res.json();
                      setMessage(`Stock en 0 para ${data.updated || 0} productos.`);
                      setCreating(false);
                    }}
                    className="text-red-500 hover:underline"
                    disabled={creating}
                  >
                    Ocultar faltantes (stock 0)
                  </button>
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
            <div className="flex items-center gap-3 p-3 border-b bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selectedIds.size === priceList.products.length} onChange={() => selectedIds.size === priceList.products.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(priceList.products.map(p => p.id)))} className="w-4 h-4" />
                <span className="text-xs font-medium text-gray-600">Todos</span>
              </label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600">
                <option value="">Todas las lineas</option>
                {[...new Set(priceList.products.map(p => p.category).filter(Boolean))].map(cat => <option key={cat} value={cat || ""}>{cat}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setViewMode("table")} className={`p-1 rounded ${viewMode==="table"?"bg-blue-100 text-blue-600":"text-gray-400"}`} title="Lista"><List className="h-4 w-4"/></button>
                <button onClick={() => setViewMode("grid")} className={`p-1 rounded ${viewMode==="grid"?"bg-blue-100 text-blue-600":"text-gray-400"}`} title="Cuadricula"><LayoutGrid className="h-4 w-4"/></button>
              </div>
              <span className="text-xs text-gray-400">{selectedIds.size} de {priceList.totalRows}</span>
            </div>

            <div className={viewMode === "grid" ? "" : "hidden"}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                {priceList.products.filter(p => !categoryFilter || p.category === categoryFilter).map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <div key={p.id} onClick={() => toggleProduct(p.id)}
                      className={`cursor-pointer rounded-lg border-2 p-3 ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                      <div className="flex items-start justify-between mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${p.selected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.selected ? "> $100" : "-"}
                        </span>
                        {p.available > 0 && <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{p.available}</span>}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-400 font-mono mb-1">{p.sku}</p>}
                      {p.category && <p className="text-xs text-gray-400 mb-1">{p.category}</p>}
                      <div className="flex justify-between items-end">
                        <div><p className="text-xs text-gray-400">Costo</p><p className="text-sm font-semibold text-gray-800">{formatCurrency(Number(p.cost))}</p></div>
                        <div className="text-right"><p className="text-xs text-gray-400">Venta</p><p className="text-sm font-bold text-green-600">{formatCurrency(Number(p.sellPrice))}</p></div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500">Utilidad</span>
                        <span className={`font-semibold ${Number(p.profit) > 100 ? "text-blue-600" : "text-gray-400"}`}>{formatCurrency(Number(p.profit))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={viewMode === "table" ? "" : "hidden"}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="w-10 px-3 py-2 text-center"><span className="text-xs font-medium text-gray-500">Sel.</span></th>
                    <th className="px-3 py-2 font-medium text-gray-600">Producto</th>
                    <th className="px-3 py-2 font-medium text-gray-600">SKU</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Linea</th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-right">Costo</th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-right">Venta</th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-right">Utilidad</th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-right">Stock</th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {priceList.products.filter(p => !categoryFilter || p.category === categoryFilter).map((p) => {
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
                        <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">
                          {p.sku || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {p.category || "-"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                          {formatCurrency(Number(p.cost))}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-600 whitespace-nowrap">
                          {formatCurrency(Number(p.sellPrice))}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
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
                        <td className="px-3 py-2 text-right text-gray-700">
                          {p.available > 0 ? p.available : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
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
                onClick={handleUpdateStock}
                disabled={selectedIds.size === 0 || creating}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <ArrowRight className="h-4 w-4" />
                Actualizar precios y stock
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
                  ? "Procesando..."
                  : `Crear y publicar (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {!priceList && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 mr-2">Catalogo ({catalogProducts.length})</h2>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nombre, SKU, marca..." className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none" />
            </div>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600">
              <option value="">Todas las marcas</option>
              {[...new Set(catalogProducts.map(p => p.supplier?.name).filter(Boolean))].map(b => <option key={b as string} value={b as string}>{b}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowUpload(!showUpload)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="h-4 w-4" /> Importar {showUpload ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
              </button>
              <button onClick={fetchCatalog} className="text-sm text-blue-600 hover:underline">{catalogLoading ? "..." : "Refrescar"}</button>
              <button onClick={() => setViewMode("table")} className={`p-1.5 rounded ${viewMode==="table"?"bg-blue-100 text-blue-600":"text-gray-400"}`}><List className="h-4 w-4"/></button>
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode==="grid"?"bg-blue-100 text-blue-600":"text-gray-400"}`}><LayoutGrid className="h-4 w-4"/></button>
            </div>
          </div>

          {showUpload && (
            <div className="mb-4 rounded-xl border bg-white p-4 text-sm text-gray-500">
              <p className="mb-3">Importar productos desde Excel o directamente de la web.</p>
              <div className="flex gap-2">
                <button onClick={() => { setShowUpload(false); setFile(null); setError(""); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  <Upload className="h-4 w-4" /> Subir Excel
                </button>
                <button onClick={async () => {
                  if (!confirm("Importar productos de tutecnotienda.com?")) return;
                  setError("");
                  try {
                    const res = await fetch("/api/sellibri/import", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({}), credentials: "include" });
                    const data = await res.json();
                    if (res.ok) { alert(`Importados: ${data.imported} nuevos, ${data.skipped} existian`); fetchCatalog(); }
                    else alert(data.error || "Error");
                  } catch { alert("Error de conexion"); }
                }} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                  <Download className="h-4 w-4" /> Importar de Sellibri
                </button>
              </div>
            </div>
          )}

          {catalogLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-300"/></div>
          ) : catalogProducts.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
              No hay productos. Importa desde Sellibri o sube un Excel.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {catalogProducts.filter((p: any) => {
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!(p.name||"").toLowerCase().includes(q) && !(p.sku||"").toLowerCase().includes(q) && !(p.supplier?.name||"").toLowerCase().includes(q)) return false;
                }
                if (brandFilter && p.supplier?.name !== brandFilter) return false;
                return true;
              }).map((p: any) => (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md transition-shadow">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-32 object-cover rounded-md mb-2" loading="lazy" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded-md mb-2 flex items-center justify-center text-gray-300">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1">{p.name}</p>
                  {p.sku && <p className="text-xs text-gray-400 font-mono mb-1">{p.sku}</p>}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-400">Costo</p>
                      <p className="text-sm font-semibold text-gray-700">{formatCurrency(Number(p.cost))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Venta</p>
                      <p className="text-sm font-bold text-green-600">{formatCurrency(Number(p.sellPrice))}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {p.sellibriUrl ? (
                      <a href={p.sellibriUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline">Ver en web</a>
                    ) : (
                      <span className="text-xs text-gray-300">Sin publicar</span>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch("/api/tecnotizacion/sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ productIds: [p.id] }),
                            credentials: "include",
                          });
                          const d = await res.json();
                          alert(d.sent > 0 ? "Enviado a Tecnotizacion" : "Error");
                        }}
                        className="text-xs text-indigo-500 hover:text-indigo-700 px-1 py-0.5 rounded hover:bg-indigo-50"
                        title="Enviar a Tecnotizacion"
                      >
                        📱
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch("/api/cachicamo/sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ productId: p.id }),
                            credentials: "include",
                          });
                          const d = await res.json();
                          alert(d.ok ? "Enviado a Cachicamo" : "Error: " + (d.error || ""));
                        }}
                        className="text-xs text-amber-500 hover:text-amber-700 px-1 py-0.5 rounded hover:bg-amber-50"
                        title="Enviar a Cachicamo"
                      >
                        🏷️
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch("/api/ia/auto-complete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ productId: p.id }),
                            credentials: "include",
                          });
                          const d = await res.json();
                          alert(`IA: ${d.description}, Imagenes: ${d.images}`);
                          fetchCatalog();
                        }}
                        className="text-xs text-violet-500 hover:text-violet-700 px-1.5 py-0.5 rounded hover:bg-violet-50"
                        title="Auto-completar con IA"
                      >
                        ✨
                      </button>
                      {p.synced ? (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Publicado</span>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pendiente</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
