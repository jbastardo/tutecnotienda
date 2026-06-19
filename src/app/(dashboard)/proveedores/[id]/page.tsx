"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

interface Mapping {
  id?: string;
  key: string;
  columnName: string | null;
  columnIndex: number | null;
}

interface Supplier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  mappings: Mapping[];
}

const MAPPING_KEYS = [
  { key: "name", label: "Nombre del producto", required: true },
  { key: "sku", label: "SKU / Codigo", required: false },
  { key: "cost", label: "Costo / Precio", required: true },
  { key: "category", label: "Categoria", required: false },
  { key: "available", label: "Stock disponible", required: false },
  { key: "description", label: "Descripcion", required: false },
];

export default function EditarProveedorPage() {
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    fetch(`/api/proveedores/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        const merged = MAPPING_KEYS.map((mk) => {
          const existing = (data.mappings || []).find(
            (m: Mapping) => m.key === mk.key
          );
          return {
            key: mk.key,
            columnName: existing?.columnName || "",
            columnIndex: existing?.columnIndex || null,
            id: existing?.id,
          };
        });
        setSupplier({ ...data, mappings: merged });
      })
      .catch(() => setError("Error al cargar"))
      .finally(() => setLoading(false));
  }, [params.id]);

  function updateMapping(key: string, columnName: string) {
    if (!supplier) return;
    setSupplier({
      ...supplier,
      mappings: supplier.mappings.map((m) =>
        m.key === key ? { ...m, columnName } : m
      ),
    });
  }

  async function handleSave() {
    if (!supplier) return;
    setSaving(true);
    setError("");

    const res = await fetch(`/api/proveedores/${supplier.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: supplier.name,
        active: supplier.active,
        description: supplier.description,
        mappings: supplier.mappings
          .filter((m) => m.columnName)
          .map((m) => ({
            key: m.key,
            columnName: m.columnName,
            columnIndex: m.columnIndex,
          })),
      }),
    });

    if (res.ok) {
      router.push("/proveedores");
    } else {
      const data = await res.json();
      setError(data.error || "Error al guardar");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center">
        <p className="text-gray-500">{error || "Proveedor no encontrado"}</p>
        <Link href="/proveedores" className="text-blue-600 hover:underline">
          Volver
        </Link>
      </div>
    );
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

      <h1 className="text-2xl font-bold text-gray-900">
        Editar: {supplier.name}
      </h1>
      <p className="mt-1 text-sm text-gray-500">Slug: {supplier.slug}</p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-xl border bg-white p-6">
        <h2 className="font-semibold text-gray-900">Mapeo de columnas</h2>
        <p className="mt-1 text-xs text-gray-500">
          Nombre exacto de cada columna en el Excel del proveedor
        </p>

        <div className="mt-4 space-y-3">
          {supplier.mappings.map((mapping) => {
            const mk = MAPPING_KEYS.find((k) => k.key === mapping.key)!;
            return (
              <div
                key={mapping.key}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <span className="w-32 text-sm font-medium text-gray-700">
                  {mk.label}
                  {mk.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </span>
                <span className="text-xs text-gray-400">&rarr;</span>
                <input
                  type="text"
                  value={mapping.columnName || ""}
                  onChange={(e) =>
                    updateMapping(mapping.key, e.target.value)
                  }
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder={
                    mk.key === "name"
                      ? "DESCRIPCION"
                      : mk.key === "cost"
                        ? "PRECIO $"
                        : ""
                  }
                  required={mk.required}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
