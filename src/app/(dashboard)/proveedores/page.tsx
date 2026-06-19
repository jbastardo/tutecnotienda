"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  _count?: { mappings: number; products: number };
}

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/proveedores")
      .then((r) => r.json())
      .then(setSuppliers)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este proveedor?")) return;
    await fetch(`/api/proveedores/${id}`, { method: "DELETE" });
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los proveedores y su mapeo de columnas
          </p>
        </div>
        <Link
          href="/proveedores/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-white p-12 text-center">
          <p className="text-gray-500">
            No hay proveedores. Agrega tu primer proveedor (ej: Emitech).
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{s.slug}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.active
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              {s.description && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                  {s.description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span>
                  {s._count?.mappings ?? 0} mapeos
                </span>
                <span>
                  {s._count?.products ?? 0} productos
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/proveedores/${s.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Link>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
