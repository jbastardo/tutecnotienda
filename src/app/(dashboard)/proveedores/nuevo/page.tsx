"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

const DEFAULT_MAPPING_KEYS = [
  { key: "name", label: "Nombre del producto", required: true },
  { key: "sku", label: "SKU / Codigo", required: false },
  { key: "cost", label: "Costo / Precio", required: true },
  { key: "description", label: "Descripcion", required: false },
];

export default function NuevoProveedorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [skipRows, setSkipRows] = useState(1);
  const [mappings, setMappings] = useState(
    DEFAULT_MAPPING_KEYS.map((m) => ({
      ...m,
      columnName: "",
      columnIndex: null as number | null,
    }))
  );

  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const missing = mappings
      .filter((m) => m.required && !m.columnName)
      .map((m) => m.label);

    if (missing.length > 0) {
      setError(`Columnas requeridas faltantes: ${missing.join(", ")}`);
      setLoading(false);
      return;
    }

    const mappingData = mappings.map((m) => ({
      key: m.key,
      columnName: m.columnName || null,
      columnIndex: m.columnIndex,
      sheetName: sheetName || null,
      skipRows,
    }));

    const res = await fetch("/api/proveedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, mappings: mappingData }),
    });

    if (res.ok) {
      router.push("/proveedores");
    } else {
      const data = await res.json();
      setError(data.error || "Error al crear proveedor");
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/proveedores"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a proveedores
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Nuevo proveedor</h1>
      <p className="mt-1 text-sm text-gray-500">
        Configura el proveedor y el mapeo de columnas de su Excel
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold text-gray-900">
            Informacion del proveedor
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ej: Emitech"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="emitech"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Descripcion (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                rows={2}
                placeholder="Distribuidor de tecnologia..."
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold text-gray-900">Configuracion del Excel</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre de la hoja (opcional)
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Hoja1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Filas a saltar (cabeceras)
              </label>
              <input
                type="number"
                value={skipRows}
                onChange={(e) => setSkipRows(Number(e.target.value))}
                min={0}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">
              Mapeo de columnas
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Indica el nombre exacto de cada columna en el Excel del proveedor
            </p>

            <div className="mt-4 space-y-3">
              {mappings.map((mapping, idx) => (
                <div
                  key={mapping.key}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <span className="w-32 text-sm font-medium text-gray-700">
                    {mapping.label}
                    {mapping.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">
                    &rarr;
                  </span>
                  <input
                    type="text"
                    value={mapping.columnName}
                    onChange={(e) => {
                      const updated = [...mappings];
                      updated[idx].columnName = e.target.value;
                      setMappings(updated);
                    }}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder={
                      mapping.key === "name"
                        ? "Ej: DESCRIPCION o PRODUCTO"
                        : mapping.key === "cost"
                          ? "Ej: PRECIO o COSTO USD"
                          : mapping.key === "sku"
                            ? "Ej: CODIGO o SKU"
                            : "Ej: DETALLE"
                    }
                    required={mapping.required}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? "Guardando..." : "Guardar proveedor"}
          </button>
        </div>
      </form>
    </div>
  );
}
