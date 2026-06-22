import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

const API_KEY = process.env.API_KEY || "tutecnotienda-dev-key";

export async function POST(request: Request) {
  const body = await request.json();
  const { apiKey } = body;

  if (!apiKey || apiKey !== API_KEY) {
    return NextResponse.json({ error: "API Key invalida" }, { status: 401 });
  }

  const token = await createSessionToken(apiKey);

  const response = NextResponse.json({ success: true });
  response.cookies.set("tutecnotienda_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("tutecnotienda_session");
  return response;
}
