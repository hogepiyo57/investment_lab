const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(input)));
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function hashPin(handleName: string, pin: string): Promise<string> {
  return sha256Hex(`pin:${handleName}:${pin}`);
}

export async function verifyPin(
  handleName: string,
  pin: string,
  storedHash: string
): Promise<boolean> {
  return timingSafeEqual(await hashPin(handleName, pin), storedHash);
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  return timingSafeEqual(await sha256Hex(input), await sha256Hex(expected));
}

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

export async function createAdminToken(secret: string): Promise<string> {
  const expiresAt = String(Date.now() + ADMIN_SESSION_SECONDS * 1000);
  return `${expiresAt}.${await hmacHex(secret, `admin:${expiresAt}`)}`;
}

export async function verifyAdminToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Date.now() > Number(expiresAt)) return false;
  return timingSafeEqual(await hmacHex(secret, `admin:${expiresAt}`), signature);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}
