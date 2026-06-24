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
  const minProfit = parseFloat(searchParams.get("minProfit") || "0");
  const pubStatus = searchParams.get("pubStatus");

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
  if (minProfit > 0) where.profit = { gt: minProfit };
  if (pubStatus === "pub") where.synced = true;
  if (pubStatus === "pend") where.synced = false;

  const take = limit > 0 ? limit : 100;
  const skip = (page - 1) * take;

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
  const updated = [];
  const skipped = [];

  for (const plp of priceListProducts) {
    // Check if product already exists by SKU
    const existing = plp.sku
      ? await prisma.product.findFirst({ where: { sku: plp.sku } })
      : null;

    if (existing) {
      // Compare fields - update only if something changed
      const costChanged = Math.abs(Number(existing.cost) - Number(plp.cost)) > 0.01;
      const priceChanged = Math.abs(Number(existing.sellPrice) - Number(plp.sellPrice)) > 0.01;
      const stockChanged = (existing.stock ?? 0) !== (plp.available || 0);
      const brandChanged = (plp.brand || null) !== existing.brand;
      const nameChanged = plp.name !== existing.name;

      if (costChanged || priceChanged || stockChanged || brandChanged || nameChanged) {
        const product = await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: plp.name,
            description: plp.description || existing.description,
            cost: plp.cost,
            sellPrice: plp.sellPrice,
            profit: plp.profit,
            margin: plp.margin,
            brand: plp.brand || existing.brand,
            category: plp.category || existing.category,
            stock: plp.available || 0,
            images: plp.imageUrl ? [plp.imageUrl] : existing.images,
          },
        });
        updated.push(product);
      } else {
        skipped.push(existing);
      }
      continue;
    }

    // Create new product
    const product = await prisma.product.create({
      data: {
        name: plp.name,
        description: plp.description || null,
        sku: plp.sku || null,
        cost: plp.cost,
        sellPrice: plp.sellPrice,
        profit: plp.profit,
        margin: plp.margin,
        brand: plp.brand || null,
        category: plp.category || null,
        stock: plp.available || 0,
        supplierId: plp.priceList.supplierId,
        status: "draft",
        images: plp.imageUrl ? [plp.imageUrl] : [],
        supplierProducts: plp.sku ? {
          create: {
            supplierId: plp.priceList.supplierId,
            cost: plp.cost,
            profit: plp.profit,
            supplierSku: plp.sku,
          },
        } : undefined,
      },
    });
    created.push(product);
  }

  // Dar de baja: productos del mismo proveedor que NO estan en la nueva lista
  const supplierId = priceListProducts[0]?.priceList.supplierId;
  if (supplierId) {
    // Get ALL SKUs from the entire price list (not just selected)
    const allPriceListSkus = await prisma.priceListProduct.findMany({
      where: { priceListId: priceListProducts[0].priceListId },
      select: { sku: true },
    });
    const skuSet = new Set(allPriceListSkus.map(p => p.sku).filter((s): s is string => !!s));

    if (skuSet.size > 0) {
      // Find products from this supplier that are NOT in the new price list
      const discontinued = await prisma.product.findMany({
        where: {
          supplierId,
          sku: { not: null, notIn: Array.from(skuSet) },
          stock: { gt: 0 },
        },
        select: { id: true, sku: true, name: true },
      });

      if (discontinued.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: discontinued.map(p => p.id) } },
          data: { stock: 0 },
        });
        console.log(`[Productos] ${discontinued.length} productos dados de baja (sin inventario en nueva lista)`);
      }

      return NextResponse.json({
        created, updated, skipped: skipped.length,
        discontinued: discontinued.length,
      }, { status: 201 });
    }
  }

  return NextResponse.json({ created, updated, skipped: skipped.length }, { status: 201 });
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
  const { id, supplierId, cost, sellPrice, profit, name, description, brand, category, warranty, stock, status, images } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (supplierId !== undefined) data.supplierId = supplierId || null;
  if (cost !== undefined) data.cost = cost;
  if (sellPrice !== undefined) data.sellPrice = sellPrice;
  if (profit !== undefined) data.profit = profit;
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (brand !== undefined) data.brand = brand;
  if (category !== undefined) data.category = category;
  if (warranty !== undefined) data.warranty = warranty;
  if (stock !== undefined) data.stock = stock;
  if (status !== undefined) data.status = status;
  if (images !== undefined) data.images = images;

  const product = await prisma.product.update({
    where: { id },
    data,
  });

  return NextResponse.json(product);
}
