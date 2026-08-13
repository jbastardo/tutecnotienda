const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://postgres:tutecnopassword2026@w0etrkodfuh2iwbiciimopdo:5432/tutecnotienda"
    }
  }
});

async function run() {
  const emitech = await prisma.supplier.findFirst({
    where: { name: { contains: "emitech", mode: "insensitive" } },
  });

  if (emitech) {
    await prisma.supplierMapping.deleteMany({
      where: { supplierId: emitech.id, key: "sellPrice" },
    });
    await prisma.supplierMapping.create({
      data: {
        supplierId: emitech.id,
        key: "sellPrice",
        columnIndex: 4,
        transform: "number",
      },
    });
    console.log("SUCCESS! Mapping fixed for emitech: " + emitech.id);
  } else {
    console.log("Emitech not found");
  }
}
run().catch(console.error).finally(()=>prisma.$disconnect());
