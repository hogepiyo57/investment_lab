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
