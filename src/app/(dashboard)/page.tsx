import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Truck, Package, TrendingUp, ArrowRight, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [supplierCount, productCount, syncedCount, latestProducts] =
    await Promise.all([
      prisma.supplier.count({ where: { active: true } }),
      prisma.product.count(),
      prisma.product.count({ where: { synced: true } }),
      prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { supplier: true },
      }),
    ]);

  const stats = [
    {
      label: "Proveedores",
      value: supplierCount,
      icon: Truck,
      href: "/proveedores",
    },
    {
      label: "Productos",
      value: productCount,
      icon: Package,
      href: "/productos",
    },
    {
      label: "Sincronizados",
      value: syncedCount,
      icon: TrendingUp,
      href: "/productos?filter=synced",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Resumen de productos y proveedores
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-blue-50 p-3">
                <stat.icon className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-300" />
            </div>
            <p className="mt-4 text-3xl font-bold text-gray-900">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Productos recientes
          </h2>
          <Link
            href="/productos"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ver todos
          </Link>
        </div>

        {latestProducts.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-white p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              No hay productos aun. Sube una lista de precios para empezar.
            </p>
            <Link
              href="/subir-lista"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Subir lista
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Producto
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Proveedor
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Costo
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Precio venta
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {latestProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.supplier.name}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {formatCurrency(Number(product.cost))}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-600">
                      {formatCurrency(Number(product.sellPrice))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          product.synced
                            ? "bg-green-50 text-green-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {product.synced ? "Sincronizado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
