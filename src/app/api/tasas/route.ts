import { NextResponse } from "next/server";
import { fetchExchangeRates } from "@/lib/exchange-rates";

export async function GET() {
  try {
    const rates = await fetchExchangeRates();
    return NextResponse.json(rates);
  } catch {
    return NextResponse.json({ error: "Error al obtener tasas", bcv: 0, promedio: 0 }, { status: 500 });
  }
}
