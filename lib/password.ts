// CRM bilan bir xil parol formati (bu ilovaning o'z nusxasi, CRM koddan import qilinmaydi).
// Saqlanish formati: pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>
// Eski formatlar ham tekshiriladi: tuzsiz SHA-256 hex (64 belgi) va oddiy matn.

const PBKDF2_RE = /^pbkdf2-sha256\$\d+\$[0-9a-f]+\$[0-9a-f]+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, KEY_BITS);
  return toHex(new Uint8Array(bits));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!password || !stored) return false;

  if (PBKDF2_RE.test(stored)) {
    const [, iterations, saltHex, hashHex] = stored.split("$");
    return safeEqual(await derive(password, fromHex(saltHex), Number(iterations)), hashHex);
  }

  if (SHA256_RE.test(stored)) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    return safeEqual(toHex(new Uint8Array(digest)), stored);
  }

  return safeEqual(password, stored);
}
