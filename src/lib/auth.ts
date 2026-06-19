import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.API_KEY || "tutecnotienda-secret-change-me"
);

const API_KEY_HEADER = "x-api-key";
const API_KEY = process.env.API_KEY || "tutecnotienda-dev-key";

export function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get(API_KEY_HEADER);

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : apiKeyHeader;

  return token === API_KEY || token === process.env.API_KEY;
}

export async function createSessionToken(apiKey: string): Promise<string> {
  const jwt = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);

  return jwt;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutecnotienda_session")?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export async function checkApiKey(request: Request): Promise<boolean> {
  const internalKey = request.headers.get("x-internal-key");
  if (internalKey === API_KEY) return true;
  return validateApiKey(request);
}
