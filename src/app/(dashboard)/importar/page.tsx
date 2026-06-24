"use client";

import { useEffect, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, X, ArrowRight, Loader2, Download, Clock, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Supplier { id: string; name: string; slug: string; }

interface PriceListProduct {
  id: string; sku: string | null; name: string; description: string | null;
  brand: string | null; category: string | null; cost: number; sellPrice: number; profit: number;
  selected: boolean; available: number;
}

interface PriceList {
  id: string; fileName: string; status: string; totalRows: number;
  selectedCount: number; createdAt: string;
  products: PriceListProduct[]; supplier: { name: string };
  _headers?: string[]; _errors?: string[];
}

interface LogEntry {
  id: string; time: string; operation: string; duration: number;
  created: number; updated: number; synced: number; discontinued: number;
  skipped: number; errors: number; success: boolean; errorMsg?: string;
}

export default function ImportarPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [margin, setMargin] = useState("40");
  const [progressMsg, setProgressMsg] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetch("/api/proveedores").then(r => r.json()).then(setSuppliers);
  }, []);

  useEffect(() => {
    if (priceList) {
      setSelectedIds(new Set(priceList.products.filter(p => p.selected).map(p => p.id)));
    }
  }, [priceList]);

  const addLog = (log: Omit<LogEntry, "id" | "time">) => {
    const now = new Date();
    setLogs(prev => [{
      ...log,
      id: Date.now().toString(),
      time: now.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    }, ...prev]);
  };

  const clearLogs = () => setLogs([]);

  const toggleProduct = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleUpload = async () => {
    if (!file || !selectedSupplier) return;
    setUploading(true); setError(""); setPriceList(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplierId", selectedSupplier);
    formData.append("margin", margin);
    const res = await fetch("/api/subir-lista", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) setPriceList(data);
    else setError(data.error || "Error");
    setUploading(false);
  };

  const handleCreateProducts = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);
    const start = Date.now();

    // Step 1: Create/update products in local DB
    const res = await fetch("/api/productos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    const data = await res.json();
    if (!res.ok) {
      addLog({ operation: "Crear y publicar", duration: Date.now() - start, created: 0, updated: 0, synced: 0, discontinued: 0, skipped: 0, errors: 1, success: false, errorMsg: data.error });
      setCreating(false);
      return;
    }

    const allProducts = [...(data.created || []), ...(data.updated || [])];

    // Step 2: Sync to Sellibri in parallel batches of 5
    let synced = 0;
    let syncErrors = 0;
    const batchSize = 5;
    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (product: { id: string; name: string }) => {
        const plp = priceList?.products.find(p => p.name === product.name);
        try {
          const sr = await fetch("/api/sellibri/sync", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id, available: plp?.available || 0 }),
            credentials: "include",
          });
          return sr.ok;
        } catch { return false; }
      }));
      synced += results.filter(Boolean).length;
      syncErrors += results.filter(r => !r).length;
    }

    addLog({
      operation: `Crear y publicar (${priceList?.supplier.name || "?"})`,
      duration: Date.now() - start,
      created: data.created?.length || 0,
      updated: data.updated?.length || 0,
      synced,
      discontinued: data.discontinued || 0,
      skipped: data.skipped || 0,
      errors: syncErrors,
      success: true,
    });
    setPriceList(null); setFile(null);
    setCreating(false);
  };

  const handleUpdateStock = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);
    const start = Date.now();

    const ids = Array.from(selectedIds);
    let updated = 0;
    let syncErrors = 0;

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await Promise.all(batch.map(async (id) => {
        const plp = priceList?.products.find(p => p.id === id);
        if (!plp?.sku) return;
        try {
          const cr = await fetch(`/api/productos?sku=${encodeURIComponent(plp.sku)}`);
          const existing = await cr.json();
          if (Array.isArray(existing) && existing.length > 0) {
            await fetch("/api/productos", { method: "PUT", headers: {"Content-Type":"application/json"},
              body: JSON.stringify({ id: existing[0].id, cost: Number(plp.cost), sellPrice: Number(plp.sellPrice), profit: Number(plp.profit) }) });
            if (existing[0].synced) {
              const sr = await fetch("/api/sellibri/sync", { method: "POST", headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ productId: existing[0].id, available: plp.available || 0 }), credentials: "include" });
              if (sr.ok) updated++; else syncErrors++;
            }
          }
        } catch {}
      }));
    }

    addLog({
      operation: `Actualizar precios y stock (${priceList?.supplier.name || "?"})`,
      duration: Date.now() - start,
      created: 0, updated, synced: updated, discontinued: 0, skipped: ids.length - updated, errors: syncErrors, success: true,
    });
    setCreating(false);
  };

  const runApiImport = async (label: string, url: string, body?: Record<string, unknown>) => {
    if (!confirm(`${label}?`)) return;
    setProgressMsg(label);
    const start = Date.now();
    try {
      const res = await fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body: body ? JSON.stringify(body) : undefined, credentials: "include" });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text || `HTTP ${res.status} - respuesta vacia` }; }
      const duration = Date.now() - start;
      if (res.ok) {
        addLog({
          operation: label, duration,
          created: data.imported || 0, updated: data.updated || 0,
          synced: data.synced || 0, discontinued: data.discontinued || 0,
          skipped: data.skipped || 0, errors: data.syncErrors || data.errors || 0,
          success: true, errorMsg: data.error || undefined,
        });
      } else {
        addLog({ operation: label, duration, created: 0, updated: 0, synced: 0, discontinued: 0, skipped: 0, errors: 1, success: false, errorMsg: data.error || text || `HTTP ${res.status}` });
      }
    } catch (e: any) {
      addLog({ operation: label, duration: Date.now() - start, created: 0, updated: 0, synced: 0, discontinued: 0, skipped: 0, errors: 1, success: false, errorMsg: e.message || "Error de conexion" });
    }
    setProgressMsg("");
  };

  const supplier = suppliers.find(s => s.id === selectedSupplier);

  if (!priceList) return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Importar Productos</h1>
      <p className="mt-1 text-sm text-gray-500">Sube un Excel de proveedor o importa desde otras fuentes</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Desde Excel</h2>
          <div className="space-y-4">
            <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
              <option value="">Selecciona un proveedor</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Margen (%)</label>
              <input type="number" value={margin} onChange={e => setMargin(e.target.value)}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" min="1" max="500" />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 hover:border-blue-400">
              <FileSpreadsheet className="h-8 w-8 text-gray-400" />
              <div><p className="text-sm font-medium text-gray-700">{file ? file.name : "Seleccionar archivo"}</p></div>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4"/>{error}</div>}
            <button onClick={handleUpload} disabled={!file || !selectedSupplier || uploading}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? <><Loader2 className="h-5 w-5 animate-spin"/>Procesando...</> : <><Upload className="h-5 w-5"/>Procesar Excel</>}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Desde APIs</h2>
            <div className="space-y-2">
              <button onClick={() => runApiImport("Importar de Sellibri", "/api/sellibri/import")} disabled={!!progressMsg}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg === "Importar de Sellibri" ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                {progressMsg === "Importar de Sellibri" ? progressMsg : "De Sellibri"}
              </button>
              <button onClick={() => runApiImport("Importar de Onprotec", "/api/sellibri/import-onprotec")} disabled={!!progressMsg}
                className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg === "Importar de Onprotec" ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                {progressMsg === "Importar de Onprotec" ? progressMsg : "De Onprotec (Precio 4)"}
              </button>
              <button onClick={() => runApiImport("Sincronizar pendientes", "/api/sellibri/import-onprotec", { syncOnly: true })} disabled={!!progressMsg}
                className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg === "Sincronizar pendientes" ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}
                {progressMsg === "Sincronizar pendientes" ? progressMsg : "Sincronizar pendientes"}
              </button>
              <button onClick={() => runApiImport("Importar de Tecnotizacion", "/api/tecnotizacion/import")} disabled={!!progressMsg}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg === "Importar de Tecnotizacion" ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                {progressMsg === "Importar de Tecnotizacion" ? progressMsg : "De Tecnotizacion"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="mt-6 rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-4 w-4 text-gray-400"/> Historial de operaciones
            </h3>
            <button onClick={clearLogs} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
              <Trash2 className="h-3 w-3"/> Limpiar
            </button>
          </div>
          <div className="divide-y">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${log.success ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                      {log.success ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{log.operation}</span>
                  </div>
                  <span className="text-xs text-gray-400">{log.time} · {(log.duration / 1000).toFixed(1)}s</span>
                </div>
                <div className="ml-7 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {log.created > 0 && <span className="text-green-600">{log.created} creados</span>}
                  {log.updated > 0 && <span className="text-blue-600">{log.updated} actualizados</span>}
                  {log.synced > 0 && <span className="text-indigo-600">{log.synced} sincronizados</span>}
                  {log.discontinued > 0 && <span className="text-orange-600">{log.discontinued} dados de baja</span>}
                  {log.skipped > 0 && <span className="text-gray-400">{log.skipped} sin cambios</span>}
                  {log.errors > 0 && <span className="text-red-600">{log.errors} errores</span>}
                  {log.errorMsg && <span className="text-red-500 block mt-1">{log.errorMsg}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar Productos</h1>
          <p className="text-sm text-gray-500">{priceList.fileName} · {priceList.totalRows} productos · <span className="text-green-600 font-semibold">{priceList.selectedCount} con utilidad &gt; $60</span></p>
          {(priceList as any)._headers && <p className="text-xs text-gray-400 mt-1">Headers: {(priceList as any)._headers.join(" | ")}</p>}
        </div>
        <button onClick={() => setPriceList(null)} className="text-sm text-gray-400 hover:text-gray-600">Cancelar</button>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="flex items-center gap-3 p-3 border-b bg-gray-50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selectedIds.size === priceList.products.length}
              onChange={() => selectedIds.size === priceList.products.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(priceList.products.map(p => p.id)))}
              className="w-4 h-4" />
            <span className="text-xs font-medium text-gray-600">Todos</span>
          </label>
          <span className="ml-auto text-xs text-gray-400">{selectedIds.size} de {priceList.totalRows}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="w-10 px-3 py-2 text-center text-xs text-gray-500">Sel.</th>
                <th className="px-3 py-2 text-xs text-gray-600">Producto</th>
                <th className="px-3 py-2 text-xs text-gray-600">SKU</th>
                <th className="px-3 py-2 text-xs text-gray-600">Marca</th>
                <th className="px-3 py-2 text-xs text-gray-600 text-right">Costo</th>
                <th className="px-3 py-2 text-xs text-gray-600 text-right">Venta</th>
                <th className="px-3 py-2 text-xs text-gray-600 text-right">Utilidad</th>
                <th className="px-3 py-2 text-xs text-gray-600 text-center">Stock</th>
                <th className="px-3 py-2 text-xs text-gray-600 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {priceList.products.map(p => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr key={p.id} onClick={() => toggleProduct(p.id)}
                    className={`cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-blue-50/50" : ""}`}>
                    <td className="px-3 py-2 text-center">
                      <div className={`mx-auto flex h-5 w-5 items-center justify-center rounded ${isSelected ? "bg-blue-600 text-white" : "border border-gray-300"}`}>
                        {isSelected && <Check className="h-3 w-3"/>}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-[250px] truncate">{p.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.sku || "-"}</td>
                    <td className="px-3 py-2 text-xs text-blue-600">{p.brand || "-"}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(Number(p.cost))}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">{formatCurrency(Number(p.sellPrice))}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span className={Number(p.profit) > 60 ? "text-blue-600" : "text-gray-400"}>{formatCurrency(Number(p.profit))}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">{p.available > 0 ? p.available : "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {p.selected ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><Check className="h-3 w-3"/>Pasa</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500"><X className="h-3 w-3"/>No pasa</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border bg-white p-4">
        <span className="text-sm text-gray-500">{selectedIds.size} de {priceList.totalRows}</span>
        <div className="flex items-center gap-3">
          <button onClick={handleUpdateStock} disabled={selectedIds.size === 0 || creating}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            <ArrowRight className="h-4 w-4"/>Actualizar precios y stock
          </button>
          <button onClick={handleCreateProducts} disabled={selectedIds.size === 0 || creating}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {creating ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowRight className="h-4 w-4"/>}
            {creating ? "Procesando..." : `Crear y publicar (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="mt-4 rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-4 w-4 text-gray-400"/> Historial de operaciones
            </h3>
            <button onClick={clearLogs} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
              <Trash2 className="h-3 w-3"/> Limpiar
            </button>
          </div>
          <div className="divide-y">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${log.success ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                      {log.success ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{log.operation}</span>
                  </div>
                  <span className="text-xs text-gray-400">{log.time} · {(log.duration / 1000).toFixed(1)}s</span>
                </div>
                <div className="ml-7 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {log.created > 0 && <span className="text-green-600">{log.created} creados</span>}
                  {log.updated > 0 && <span className="text-blue-600">{log.updated} actualizados</span>}
                  {log.synced > 0 && <span className="text-indigo-600">{log.synced} sincronizados</span>}
                  {log.discontinued > 0 && <span className="text-orange-600">{log.discontinued} dados de baja</span>}
                  {log.skipped > 0 && <span className="text-gray-400">{log.skipped} sin cambios</span>}
                  {log.errors > 0 && <span className="text-red-600">{log.errors} errores</span>}
                  {log.errorMsg && <span className="text-red-500 block mt-1">{log.errorMsg}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
