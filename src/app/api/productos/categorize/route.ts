import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATEGORY_RULES = [
  {
    category: 'REDES',
    keywords: ['router', 'switch', 'access point', 'patch cord', 'cable utp', 'bobina', 'mikrotik', 'ubiquiti', 'tplink', 'tp-link', 'cisco', 'aruba', 'antena', 'fibra', 'rack', 'gabinete', 'wifi', 'wi-fi']
  },
  {
    category: 'CCTV',
    keywords: ['camara', 'cámara', 'dvr', 'nvr', 'xvr', 'balun', 'dahua', 'hikvision', 'ezviz', 'cctv', 'vigilancia', 'video', 'sensor', 'alarma', 'sirena']
  },
  {
    category: 'COMPUTACION',
    keywords: ['laptop', 'notebook', 'pc', 'servidor', 'server', 'disco duro', 'hdd', 'ssd', 'memoria ram', 'ddr4', 'ddr5', 'procesador', 'intel', 'amd', 'ryzen', 'core i', 'motherboard', 'tarjeta madre', 'gpu', 'tarjeta de video', 'monitor', 'pantalla', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'macbook', 'imac']
  },
  {
    category: 'IMPRESORAS',
    keywords: ['impresora', 'impresion', 'impresión', 'toner', 'tinta', 'cartucho', 'epson', 'canon', 'hp laser', 'zebra', 'etiquetadora', 'rollo', 'termica', 'térmica']
  },
  {
    category: 'ACCESORIOS',
    keywords: ['cable', 'adaptador', 'convertidor', 'teclado', 'mouse', 'raton', 'auricular', 'audifono', 'diadema', 'mochila', 'funda', 'hub', 'docking', 'usb', 'hdmi', 'vga', 'pad', 'alfombrilla']
  },
  {
    category: 'ELECTRONICA',
    keywords: ['pos', 'punto de venta', 'lector', 'codigo de barras', 'código de barras', 'biometrico', 'biométrico', 'ups', 'regulador', 'fuente de poder', 'bateria', 'batería', 'energia', 'energía', 'inversor', 'smartwatch', 'reloj']
  }
];

function determineCategory(name: string, description: string = '') {
  const text = `${name} ${description}`.toLowerCase();
  
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return rule.category;
      }
    }
  }
  
  return 'OTROS';
}

export async function POST(request: Request) {
  try {
    const products = await prisma.product.findMany();
    let updatedCount = 0;

    for (const product of products) {
      const category = determineCategory(product.name, product.description || '');
      
      if (product.category !== category) {
        await prisma.product.update({
          where: { id: product.id },
          data: { category }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("[Categorize] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to categorize products" }, { status: 500 });
  }
}
