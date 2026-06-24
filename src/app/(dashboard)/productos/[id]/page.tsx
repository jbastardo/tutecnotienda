"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Loader2, ExternalLink, RefreshCw, Trash2,
  Package, Globe, Tag, Truck, DollarSign, Box, Shield, Layers, Image as ImageIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string; name: string; description: string | null; sku: string | null;
  cost: number; sellPrice: number; profit: number; margin: number;
  supplierId: string | null; sellibriId: string | null; sellibriUrl: string | null;
  synced: boolean; images: string[]; stock: number; brand: string | null;
  category: string | null; warranty: string | null; status: string;
  createdAt: string; updatedAt: string;
  supplier: { id: string; name: string; slug: string } | null;
}

interface Supplier { id: string; name: string; slug: string; }

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  useEffect(() => {
    fetch(`/api/productos/${id}`)
      .then(r => r.json())
      .then(d => { setProduct(d); setForm(d); setLoading(false); })
      .catch(() => { setMsg("Error cargando producto"); setLoading(false); });
    fetch("/api/proveedores").then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []));
  }, [id]);

  const updateField = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct(updated);
        setForm(updated);
        setMsg("Guardado correctamente");
      } else {
        const err = await res.json();
        setMsg(`Error: ${err.error || "desconocido"}`);
      }
    } catch { setMsg("Error de conexion"); }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleSync = async () => {
    setSyncing(true); setMsg("");
    try {
      const res = await fetch("/api/sellibri/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`Sincronizado: ${data.action}`);
        // Refresh product data
        const updated = await fetch(`/api/productos/${id}`).then(r => r.json());
        setProduct(updated);
        setForm(updated);
      } else {
        setMsg(`Error: ${data.error || "desconocido"}`);
      }
    } catch { setMsg("Error de conexion"); }
    setSyncing(false);
    setTimeout(() => setMsg(""), 5000);
  };

  const handleDelete = async () => {
    if (!confirm("Eliminar este producto permanentemente?")) return;
    await fetch(`/api/productos/${id}`, { method: "DELETE" });
    router.push("/productos");
  };

  const addImage = () => {
    if (!newImageUrl.trim()) return;
    const current = form.images || [];
    updateField("images", [...current, newImageUrl.trim()]);
    setNewImageUrl("");
  };

  const removeImage = (idx: number) => {
    const current = form.images || [];
    updateField("images", current.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-300"/></div>;
  if (!product) return <div className="text-center py-12 text-gray-400">Producto no encontrado</div>;

  const hasChanges = JSON.stringify(form) !== JSON.stringify(product);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/productos")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-5 w-5"/>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-500">
              {product.sku && <span className="font-mono">{product.sku}</span>}
              {product.sku && product.brand && <span className="mx-1.5">·</span>}
              {product.brand && <span>{product.brand}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-sm ${msg.includes("Error") ? "text-red-600" : "text-green-600"}`}>{msg}</span>}
          <button onClick={handleSync} disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
            {syncing ? "Sincronizando..." : "Sincronizar a Web"}
          </button>
          <button onClick={handleSave} disabled={saving || !hasChanges}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
            Guardar
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
            <Trash2 className="h-4 w-4"/>
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${product.synced ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
          <Globe className="h-3 w-3"/>
          {product.synced ? "Publicado en web" : "No publicado"}
        </span>
        {product.sellibriUrl && (
          <a href={product.sellibriUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <ExternalLink className="h-3 w-3"/> Ver en tutecnotienda.com
          </a>
        )}
        {product.sellibriId && <span className="text-xs text-gray-400">Sellibri ID: {product.sellibriId}</span>}
        <span className="text-xs text-gray-400 ml-auto">Creado: {new Date(product.createdAt).toLocaleDateString("es-VE")}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column - Basic info */}
        <div className="space-y-5">
          <Section title="Informacion basica" icon={Package}>
            <Field label="Nombre">
              <input value={form.name || ""} onChange={e => updateField("name", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
            </Field>
            <Field label="SKU">
              <input value={form.sku || ""} onChange={e => updateField("sku", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"/>
            </Field>
            <Field label="Descripcion">
              <textarea value={form.description || ""} onChange={e => updateField("description", e.target.value)} rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
            </Field>
          </Section>

          <Section title="Marca y categoria" icon={Tag}>
            <Field label="Marca">
              <input value={form.brand || ""} onChange={e => updateField("brand", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
            </Field>
            <Field label="Categoria">
              <input value={form.category || ""} onChange={e => updateField("category", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
            </Field>
            <Field label="Garantia">
              <input value={form.warranty || ""} onChange={e => updateField("warranty", e.target.value)} placeholder="Ej: 1 ano, 6 meses..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
            </Field>
          </Section>

          <Section title="Proveedor" icon={Truck}>
            <Field label="Proveedor asignado">
              <select value={form.supplierId || ""} onChange={e => updateField("supplierId", e.target.value || null)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </Section>
        </div>

        {/* Right column - Pricing, stock, images */}
        <div className="space-y-5">
          <Section title="Precios" icon={DollarSign}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo (USD)">
                <input type="number" step="0.01" value={form.cost || 0} onChange={e => updateField("cost", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
              </Field>
              <Field label="Precio venta (USD)">
                <input type="number" step="0.01" value={form.sellPrice || 0} onChange={e => updateField("sellPrice", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-green-700 focus:border-blue-500 focus:outline-none"/>
              </Field>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Utilidad:</span><span className="font-semibold text-blue-600">{formatCurrency(Number(form.sellPrice || 0) - Number(form.cost || 0))}</span></div>
              <div className="flex justify-between mt-1"><span className="text-gray-500">Margen:</span><span>{(form.cost ?? 0) > 0 ? (((Number(form.sellPrice) - Number(form.cost)) / Number(form.cost)) * 100).toFixed(1) : 0}%</span></div>
            </div>
          </Section>

          <Section title="Inventario" icon={Box}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock">
                <input type="number" value={form.stock || 0} onChange={e => updateField("stock", parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
              </Field>
              <Field label="Estado">
                <select value={form.status || "draft"} onChange={e => updateField("status", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Imagenes" icon={ImageIcon}>
            <div className="space-y-2">
              {(form.images || []).map((url, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border p-2">
                  <img src={url} alt="" className="h-12 w-12 rounded object-cover bg-gray-100"/>
                  <input value={url} onChange={e => {
                    const imgs = [...(form.images || [])];
                    imgs[idx] = e.target.value;
                    updateField("images", imgs);
                  }} className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs font-mono focus:outline-none"/>
                  <button onClick={() => removeImage(idx)} className="text-red-400 hover:text-red-600 text-xs">X</button>
                </div>
              ))}
              {(form.images || []).length === 0 && <p className="text-xs text-gray-400">Sin imagenes</p>}
            </div>
            <div className="flex gap-2 mt-2">
              <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="URL de imagen..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"/>
              <button onClick={addImage} className="rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200">Agregar</button>
            </div>
          </Section>

          {/* Sellibri sync info */}
          <Section title="Sincronizacion web" icon={Globe}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Estado:</span>
                <span className={product.synced ? "text-green-600 font-medium" : "text-yellow-600"}>
                  {product.synced ? "Sincronizado" : "Pendiente"}
                </span>
              </div>
              {product.sellibriId && <div className="flex justify-between"><span className="text-gray-500">Sellibri ID:</span><span className="font-mono text-xs">{product.sellibriId}</span></div>}
              {product.sellibriUrl && <a href={product.sellibriUrl} target="_blank" className="flex items-center gap-1 text-blue-600 hover:underline"><ExternalLink className="h-3 w-3"/> Ver en la web</a>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
        <Icon className="h-4 w-4 text-gray-400"/> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
