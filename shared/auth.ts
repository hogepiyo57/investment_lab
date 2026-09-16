const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(handleName: string, pin: string): Promise<string> {
  return sha256Hex(`pin:${handleName}:${pin}`);
}

export async function verifyPin(
  handleName: string,
  pin: string,
  storedHash: string
): Promise<boolean> {
  const candidate = await hashPin(handleName, pin);
  return timingSafeEqual(candidate, storedHash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12時間

export async function createSessionCookieValue(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = await hmacHex(secret, String(expiresAt));
  return `${expiresAt}.${signature}`;
}

export async function verifySessionCookieValue(
  value: string | undefined,
  secret: string
): Promise<boolean> {
  if (!value) return false;
  const [expiresAtStr, signature] = value.split(".");
  if (!expiresAtStr || !signature) return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = await hmacHex(secret, expiresAtStr);
  return timingSafeEqual(expected, signature);
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    result[key] = decodeURIComponent(rest.join("="));
  }
  return result;
}

export const SESSION_COOKIE_NAME = "dashboard_session";
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
