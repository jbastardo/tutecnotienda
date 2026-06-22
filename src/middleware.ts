import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/api/sellibri/test", "/api/sellibri/debug", "/api/cachicamo/test", "/api/tecnotizacion/test"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const internalKey = request.headers.get("x-internal-key");
    if (internalKey === process.env.API_KEY) {
      return NextResponse.next();
    }

    const token = request.cookies.get("tutecnotienda_session")?.value;
    if (token) {
      const valid = await verifySessionToken(token);
      if (valid) return NextResponse.next();
    }

    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = request.cookies.get("tutecnotienda_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const valid = await verifySessionToken(token);
  if (!valid) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("tutecnotienda_session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
