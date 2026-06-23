"use client";

import { useEffect, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Check, X, ArrowRight, Loader2, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  slug: string;
}

interface PriceListProduct {
  id: string; sku: string | null; name: string; description: string | null;
  category: string | null; cost: number; sellPrice: number; profit: number;
  selected: boolean; available: number;
}

interface PriceList {
  id: string; fileName: string; status: string; totalRows: number;
  selectedCount: number; createdAt: string;
  products: PriceListProduct[]; supplier: { name: string };
  _headers?: string[]; _errors?: string[];
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
  const [message, setMessage] = useState("");
  const [margin, setMargin] = useState("40");
  const [progressMsg, setProgressMsg] = useState("");

  useEffect(() => {
    fetch("/api/proveedores").then(r => r.json()).then(setSuppliers);
  }, []);

  useEffect(() => {
    if (priceList) {
      setSelectedIds(new Set(priceList.products.filter(p => p.selected).map(p => p.id)));
    }
  }, [priceList]);

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
    setCreating(true); setMessage("");
    const res = await fetch("/api/productos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Error"); setCreating(false); return; }
    let synced = 0;
    for (const product of data) {
      const plp = priceList?.products.find(p => p.name === product.name);
      try {
        const sr = await fetch("/api/sellibri/sync", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, available: plp?.available || 0 }),
          credentials: "include",
        });
        if (sr.ok) synced++;
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    setMessage(`${data.length} creados, ${synced} sincronizados`);
    setPriceList(null); setFile(null);
    setCreating(false);
  };

  const handleUpdateStock = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true); setMessage("Actualizando...");
    let updated = 0;
    for (const id of Array.from(selectedIds)) {
      const plp = priceList?.products.find(p => p.id === id);
      if (!plp?.sku) continue;
      const cr = await fetch(`/api/productos?sku=${encodeURIComponent(plp.sku)}`);
      const existing = await cr.json();
      if (Array.isArray(existing) && existing.length > 0) {
        await fetch("/api/productos", { method: "PUT", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ id: existing[0].id, cost: Number(plp.cost), sellPrice: Number(plp.sellPrice), profit: Number(plp.profit) }) });
        if (existing[0].synced) {
          try {
            const sr = await fetch("/api/sellibri/sync", { method: "POST", headers: {"Content-Type":"application/json"},
              body: JSON.stringify({ productId: existing[0].id, available: plp.available || 0 }), credentials: "include" });
            if (sr.ok) updated++;
          } catch {}
        }
      }
      await new Promise(r => setTimeout(r, 350));
    }
    setMessage(`Actualizados: ${updated}`);
    setCreating(false);
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
              <button onClick={async () => {
                if (!confirm("Importar de tutecnotienda.com?")) return;
                setProgressMsg("Importando de Sellibri...");
                const res = await fetch("/api/sellibri/import", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({}), credentials: "include" });
                const data = await res.json();
                setProgressMsg("");
                alert(res.ok ? `OK: ${data.imported} nuevos, ${data.updated || 0} actualizados` : data.error);
              }} disabled={!!progressMsg}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                {progressMsg || "De Sellibri"}
              </button>
              <button onClick={async () => {
                if (!confirm("Importar de Onprotec?")) return;
                setProgressMsg("Importando de Onprotec (Precio 4)...");
                const res = await fetch("/api/sellibri/import-onprotec", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({}), credentials: "include" });
                const data = await res.json();
                setProgressMsg("");
                alert(res.ok ? `OK: ${data.imported} nuevos, ${data.updated || 0} actualizados` : data.error);
              }} disabled={!!progressMsg}
                className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                {progressMsg || "De Onprotec (Precio 4)"}
              </button>
              <button onClick={async () => {
                if (!confirm("Importar de Tecnotizacion?")) return;
                setProgressMsg("Importando de Tecnotizacion...");
                const res = await fetch("/api/tecnotizacion/import", { method: "POST", credentials: "include" });
                const data = await res.json();
                setProgressMsg("");
                alert(res.ok ? `OK: ${data.imported} locales, ${data.synced} a la web` : data.error);
              }} disabled={!!progressMsg}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {progressMsg ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
                {progressMsg || "De Tecnotizacion"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar Productos</h1>
          <p className="text-sm text-gray-500">{priceList.fileName} · {priceList.totalRows} productos · <span className="text-green-600 font-semibold">{priceList.selectedCount} con utilidad &gt; $100</span></p>
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
                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(Number(p.cost))}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">{formatCurrency(Number(p.sellPrice))}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <span className={Number(p.profit) > 100 ? "text-blue-600" : "text-gray-400"}>{formatCurrency(Number(p.profit))}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">{p.available > 0 ? p.available : "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {p.selected ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><Check className="h-3 w-3"/>&gt; $100</span>
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
          {message && <span className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>{message}</span>}
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
    </div>
  );
}
