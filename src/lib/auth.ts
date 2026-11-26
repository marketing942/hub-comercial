import { cookies } from "next/headers";

/**
 * Niveis de acesso (26/11/2026):
 *  - admin: tudo (GAV, BUs, Vendedores, Configuracoes).
 *  - supervisor: supervisor comercial — SO assiste os paineis das BUs e o de
 *    Vendedores (TVs do comercial). Sem GAV, sem Configuracoes, sem escrita.
 *  - seller: o proprio Meu Painel + os slides das proprias BUs.
 */
export type Role = "admin" | "supervisor" | "seller";
export type Session = { role: Role; sellerId?: string };

const COOKIE = "hub_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  // Use SESSION_SECRET quando definido (recomendado, >= 32 chars aleatorios).
  // Sem ele, cai num fallback para nao derrubar o app — porem cookies ficam
  // forjaveis. DEFINA SESSION_SECRET na Vercel para seguranca real.
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlEncodeStr(s: string): string {
  return b64urlEncode(new TextEncoder().encode(s));
}

function b64urlDecodeStr(s: string): string {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlEncode(sig);
}

type SignedSession = Session & { exp: number };

export async function encodeSession(s: Session): Promise<string> {
  const payload: SignedSession = { ...s, exp: Date.now() + MAX_AGE * 1000 };
  const body = b64urlEncodeStr(JSON.stringify(payload));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

// Comparacao de assinatura em tempo constante (evita timing attack).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function decodeSession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    // hmac() usa secret(); se SESSION_SECRET estiver ausente/fraco, isso
    // lanca. Aqui tratamos como "sessao invalida" (nao derruba o app) —
    // o usuario e mandado ao login em vez de receber um 500 no middleware.
    const expected = await hmac(body);
    if (!safeEqual(expected, sig)) return null;
    const parsed = JSON.parse(b64urlDecodeStr(body)) as SignedSession;
    if (!parsed || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }
    const { role, sellerId } = parsed;
    if (role !== "admin" && role !== "supervisor" && role !== "seller") return null;
    return { role, sellerId };
  } catch (err) {
    console.error("decodeSession falhou:", err);
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = cookies().get(COOKIE)?.value;
  return decodeSession(c);
}

export async function sessionCookie(s: Session) {
  return {
    name: COOKIE,
    value: await encodeSession(s),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearCookie() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
