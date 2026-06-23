"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List, Package, Search, Loader2, Download, ExternalLink, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculatePricing, formatBs, formatUsd } from "@/lib/pricing";
import Link from "next/link";

interface CatalogProduct {
  id: string; name: string; sku: string | null; description: string | null;
  cost: number; sellPrice: number; profit: number; synced: boolean;
  sellibriId: string | null; sellibriUrl: string | null; status: string;
  supplier: { id: string; name: string } | null; supplierId: string | null;
  images: string[]; createdAt: string;
}

interface Supplier {
  id: string; name: string; slug: string;
}

export default function ProductosPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [rates, setRates] = useState({ bcv: 0, promedio: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minProfit, setMinProfit] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pub" | "pend">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetch("/api/proveedores").then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []));
    fetch("/api/tasas").then(r => r.json()).then(d => { if (d.bcv > 0) setRates(d); }).catch(() => {});
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (minProfit) params.set("minProfit", minProfit);
    if (statusFilter !== "all") params.set("pubStatus", statusFilter);
    params.set("limit", "100");
    params.set("page", "1");
    const res = await fetch(`/api/productos?${params}`);
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setHasMore(data.length === 100);
    setPage(1);
    setLoading(false);
  };

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    const params = new URLSearchParams();
    if (minProfit) params.set("minProfit", minProfit);
    if (statusFilter !== "all") params.set("pubStatus", statusFilter);
    params.set("limit", "100");
    params.set("page", String(next));
    const res = await fetch(`/api/productos?${params}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setProducts(prev => [...prev, ...data]);
      setHasMore(data.length === 100);
    }
  };

  // Refetch when filters change
  useEffect(() => { fetchProducts(); }, [minProfit, statusFilter]);

  const syncToSellibri = async (id: string) => {
    setSyncing(id);
    const res = await fetch("/api/sellibri/sync", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({productId: id}), credentials: "include" });
    setSyncing(null);
    if (res.ok) fetch("/api/productos?synced=true&limit=50&page=1").then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
  };

  const syncToTecnotizacion = async (id: string) => {
    setSyncing(id);
    await fetch("/api/tecnotizacion/sync", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({productIds: [id]}), credentials: "include" });
    setSyncing(null);
  };

  const bulkSyncSellibri = async () => {
    const ids = Array.from(selected);
    setSyncMsg(`Publicando ${ids.length}...`);
    let done = 0;
    for (const id of ids) {
      await fetch("/api/sellibri/sync", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({productId: id}), credentials: "include" });
      done++;
      setSyncMsg(`Publicando ${done}/${ids.length}...`);
      await new Promise(r => setTimeout(r, 350));
    }
    setSyncMsg(`Publicados: ${done}`);
    setSelected(new Set());
    fetchProducts();
    setTimeout(() => setSyncMsg(""), 3000);
  };

  const bulkSyncTecnotizacion = async () => {
    const ids = Array.from(selected);
    await fetch("/api/tecnotizacion/sync", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({productIds: ids}), credentials: "include" });
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };

  const brands = [...new Set(products.map(p => p.supplier?.name).filter(Boolean))];

  const filtered = products.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!(p.name||"").toLowerCase().includes(q) && !(p.sku||"").toLowerCase().includes(q) && !(p.supplier?.name||"").toLowerCase().includes(q)) return false;
    }
    if (brandFilter && p.supplier?.name !== brandFilter) return false;
    if (supplierFilter && p.supplierId !== supplierFilter) return false;
    if (minPrice && Number(p.sellPrice) < Number(minPrice)) return false;
    if (maxPrice && Number(p.sellPrice) > Number(maxPrice)) return false;
    if (inStockOnly && Number(p.cost) <= 0) return false;
    return true;
  });

  const exportToExcel = () => {
    const items = selected.size > 0 ? filtered.filter(p => selected.has(p.id)) : filtered;
    const header = "Nombre\tSKU\tMarca\tCosto\tPrecio Venta\tUtilidad\tPublicado\n";
    const rows = items.map(p =>
      `${p.name}\t${p.sku||""}\t${p.supplier?.name||""}\t${p.cost}\t${p.sellPrice}\t${p.profit}\t${p.synced?"Si":"No"}`
    ).join("\n");
    const blob = new Blob([header + rows], {type: "text/tab-separated-values"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "productos-tutecnotienda.tsv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-300"/></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500">{filtered.length} de {products.length} productos en catalogo</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4"/> Exportar
          </button>
          <Link href="/importar" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Upload className="h-4 w-4"/> Importar
          </Link>
          <button onClick={() => setViewMode("table")} className={`p-1.5 rounded ${viewMode==="table"?"bg-blue-100 text-blue-600":"text-gray-400"}`}><List className="h-4 w-4"/></button>
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode==="grid"?"bg-blue-100 text-blue-600":"text-gray-400"}`}><LayoutGrid className="h-4 w-4"/></button>
        </div>
      </div>

      {rates.bcv > 0 && (
        <div className="mb-4 flex items-center gap-6 rounded-lg bg-blue-50 px-4 py-2 text-sm">
          <span className="font-semibold text-blue-800">BCV: Bs {rates.bcv.toFixed(2)}</span>
          <span className="text-blue-700">Paralelo: Bs {rates.promedio.toFixed(2)}</span>
          <span className="ml-auto text-xs text-blue-500">costo $100 → {40}% → venta ${(100/0.6).toFixed(0)}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, SKU, marca..."
            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
        </div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs">
          <option value="">Marca: Todas</option>
          {brands.map(b => <option key={b} value={b as string}>{b}</option>)}
        </select>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs">
          <option value="">Proveedor: Todos</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Precio min" className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-xs"/>
        <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Precio max" className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-xs"/>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="w-3.5 h-3.5"/> Con stock
        </label>
        <input type="number" value={minProfit} onChange={e => setMinProfit(e.target.value)} placeholder="Utilidad min" className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-xs"/>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="rounded-lg border border-gray-300 px-2 py-2 text-xs">
          <option value="all">Estado: Todos</option>
          <option value="pub">Publicados</option>
          <option value="pend">Pendientes</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-gray-400"><Package className="mx-auto h-8 w-8 mb-2"/>Sin resultados</div>
      ) : (
        <>
        <div className="mb-2 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} className="w-3.5 h-3.5"/>
            {selected.size > 0 ? `${selected.size} seleccionados` : "Seleccionar todos"}
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={bulkSyncSellibri} disabled={!!syncMsg} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50">
                {syncMsg || `Publicar en Web (${selected.size})`}
              </button>
              <button onClick={bulkSyncTecnotizacion} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">
                Enviar a Tecnotizacion ({selected.size})
              </button>
            </div>
          )}
        </div>
        {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(p => (
            <div key={p.id} onClick={() => toggleSelect(p.id)} className="rounded-lg border-2 p-3 hover:shadow-md transition-shadow cursor-pointer relative" style={{borderColor: selected.has(p.id) ? "#3B82F6" : "#E5E7EB"}}>
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="absolute top-2 right-2 w-3.5 h-3.5" onClick={e => e.stopPropagation()}/>
              {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-32 object-cover rounded-md mb-2" loading="lazy"/>
                : <div className="w-full h-32 bg-gray-100 rounded-md mb-2 flex items-center justify-center text-gray-300"><Package className="h-8 w-8"/></div>}
              <p className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1">{p.name}</p>
              {p.sku && <p className="text-xs text-gray-400 font-mono mb-1">{p.sku}</p>}
              {p.supplier?.name && <p className="text-xs text-gray-400 mb-1">{p.supplier.name}</p>}
              <div className="flex justify-between items-end">
                <div><p className="text-xs text-gray-400">Costo</p><p className="text-sm font-semibold text-gray-800">{formatCurrency(Number(p.cost))}</p></div>
                <div className="text-right"><p className="text-xs text-gray-400">Venta</p><p className="text-sm font-bold text-green-600">{formatCurrency(Number(p.sellPrice))}</p></div>
              </div>
              <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                <span className="text-gray-500">Util: {formatCurrency(Number(p.profit))}</span>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); syncToSellibri(p.id); }}
                    className="text-indigo-500 hover:text-indigo-700 text-xs" title="Sincronizar">📱</button>
                  {p.sellibriUrl && <a href={p.sellibriUrl} target="_blank" className="text-blue-500 hover:underline text-xs"><ExternalLink className="h-3 w-3 inline"/></a>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${p.synced ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                    {p.synced ? "Pub" : "Pend"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-2 text-xs text-gray-600">Producto</th>
              <th className="px-3 py-2 text-xs text-gray-600">SKU</th>
              <th className="px-3 py-2 text-xs text-gray-600">Marca</th>
              <th className="px-3 py-2 text-xs text-gray-600 text-right">Costo</th>
              <th className="px-3 py-2 text-xs text-gray-600 text-right">Venta</th>
              <th className="px-3 py-2 text-xs text-gray-600 text-right">Utilidad</th>
              <th className="px-3 py-2 text-xs text-gray-600 text-center">Estado</th>
              <th className="px-3 py-2 text-xs text-gray-600"></th>
            </tr></thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[250px] truncate">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.sku||"-"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{p.supplier?.name||"-"}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(Number(p.cost))}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-600">{formatCurrency(Number(p.sellPrice))}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-600">{formatCurrency(Number(p.profit))}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${p.synced?"bg-green-50 text-green-600":"bg-yellow-50 text-yellow-600"}`}>{p.synced?"Publicado":"Pendiente"}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => syncToSellibri(p.id)} disabled={syncing === p.id} className="text-xs text-indigo-500 hover:text-indigo-700">📱</button>
                      {p.sellibriUrl && <a href={p.sellibriUrl} target="_blank" className="text-blue-500 hover:underline text-xs"><ExternalLink className="h-3 w-3 inline"/></a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        </>
      )}
      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <button onClick={loadMore} className="text-sm text-blue-600 hover:underline">
            Cargar mas productos...
          </button>
        </div>
      )}
    </div>
  );
}
