/**
 * Sesión: cookie con el email y el vencimiento, firmada con HMAC-SHA256
 * (Web Crypto, anda en el proxy y en las Server Actions). No importa
 * "server-only" porque la usa src/proxy.ts; el secreto no tiene prefijo
 * NEXT_PUBLIC_, así que nunca llega al navegador.
 */

export const SESSION_COOKIE = "vx3_session";
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

/** Credenciales fijas mientras no hay usuarios en la base. */
const DEMO_USER = { email: "eliasllaury@gmail.com", password: "Admin123456!" } as const;

export function checkCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_USER.email && password === DEMO_USER.password;
}

/** En producción AUTH_SECRET es obligatoria; el valor por defecto es solo para la demo local. */
function secret() {
  return process.env.AUTH_SECRET || "vx3-demo-local-secret";
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

/** Comparación en tiempo constante, para no filtrar la firma por timing. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

type SessionPayload = { email: string; exp: number };

export async function createSessionToken(email: string, now = Date.now()) {
  const payload: SessionPayload = { email, exp: now + SESSION_MAX_AGE_S * 1000 };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

/** Devuelve la sesión si la firma es válida y no venció; si no, null. */
export async function verifySessionToken(token: string | undefined, now = Date.now()) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, await sign(body))) return null;

  try {
    const payload = JSON.parse(fromBase64Url(body)) as SessionPayload;
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
