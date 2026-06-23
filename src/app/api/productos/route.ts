import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const synced = searchParams.get("synced");
  const supplierId = searchParams.get("supplierId");
  const sku = searchParams.get("sku");
  const notInList = searchParams.get("notInList");
  const limit = parseInt(searchParams.get("limit") || "0");
  const page = parseInt(searchParams.get("page") || "1");

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (synced === "true") where.synced = true;
  if (synced === "false") where.synced = false;
  if (supplierId) where.supplierId = supplierId;
  if (sku) where.sku = sku;
  if (notInList) {
    const skus = notInList.split(",").filter(Boolean);
    where.NOT = { sku: { in: skus } };
    where.synced = true;
  }

  const take = limit > 0 ? limit : 50;
  const skip = limit > 0 ? 0 : (page - 1) * 50;

  const products = await prisma.product.findMany({
    where,
    include: { supplier: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "IDs requeridos" }, { status: 400 });
  }

  const priceListProducts = await prisma.priceListProduct.findMany({
    where: { id: { in: ids }, selected: true },
    include: { priceList: true },
  });

  if (priceListProducts.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron productos seleccionados" },
      { status: 400 }
    );
  }

  const created = [];
  for (const plp of priceListProducts) {
    const product = await prisma.product.create({
      data: {
        name: plp.name,
        description: plp.description || null,
        sku: plp.sku || null,
        cost: plp.cost,
        sellPrice: plp.sellPrice,
        profit: plp.profit,
        margin: plp.margin,
        supplierId: plp.priceList.supplierId,
        status: "draft",
        images: plp.imageUrl ? [plp.imageUrl] : [],
        supplierProducts: {
          create: {
            supplierId: plp.priceList.supplierId,
            cost: plp.cost,
            profit: plp.profit,
            supplierSku: plp.sku || null,
          },
        },
      },
    });
    created.push(product);
  }

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const { id, allSynced } = await request.json();

  if (allSynced) {
    const deleted = await prisma.product.deleteMany({
      where: { synced: true },
    });
    return NextResponse.json({ success: true, deleted: deleted.count });
  }

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, supplierId, cost, sellPrice, profit } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (supplierId !== undefined) data.supplierId = supplierId || null;
  if (cost !== undefined) data.cost = cost;
  if (sellPrice !== undefined) data.sellPrice = sellPrice;
  if (profit !== undefined) data.profit = profit;

  const product = await prisma.product.update({
    where: { id },
    data,
  });

  return NextResponse.json(product);
}
