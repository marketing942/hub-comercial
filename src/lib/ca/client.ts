/**
 * Client HTTP da Conta Azul (API v2), server-side.
 *
 * Responsável por: ler o token de `ca_conexao`, renovar pelo refresh_token antes
 * de expirar (e em 401), e fazer GETs autenticados respeitando o limite da API.
 * NÃO pode ser importado em componente de cliente — o token nunca vai ao browser.
 *
 * Portado de uma integração que já roda em produção contra esta mesma conta;
 * os detalhes abaixo (throttle, single-flight, backoff do 429) são correções de
 * problemas que já aconteceram lá, não precaução teórica.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { CA_API_BASE, CA_ENV, CA_OAUTH } from "./config";

export class CaError extends Error {
  constructor(
    message: string,
    readonly kind: "sem-conexao" | "auth" | "http" | "config",
    readonly status?: number,
  ) {
    super(message);
    this.name = "CaError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Folga para renovar antes da expiração real e não tomar 401 na borda. */
const SKEW_MS = 60_000;

/**
 * Throttle GLOBAL de saída.
 *
 * O Conta Azul aplica um "spike arrest" de 10 req/s (429 `SpikeArrestViolation`)
 * com janela de 1 segundo. Espaçamos os INÍCIOS de requisição em ~130ms
 * (≈7,7 req/s) para ficar abaixo do teto mesmo com paginações concorrentes.
 * Como o JS é single-thread, atualizar `proximoInicio` de forma síncrona antes
 * do await já escalona as chamadas concorrentes sem colisão.
 */
const GAP_MS = 130;
let proximoInicio = 0;
async function throttle(): Promise<void> {
  const agora = Date.now();
  const inicio = Math.max(agora, proximoInicio + GAP_MS);
  proximoInicio = inicio;
  const espera = inicio - agora;
  if (espera > 0) await sleep(espera);
}

function basicAuth(): string {
  return Buffer.from(`${CA_ENV.clientId}:${CA_ENV.clientSecret}`).toString("base64");
}

type TokenRow = { access_token: string; refresh_token: string | null; expires_at: string | null };

async function lerConexao(): Promise<TokenRow | null> {
  const { data } = await supabaseAdmin
    .from("ca_conexao")
    .select("access_token, refresh_token, expires_at")
    .eq("id", true)
    .maybeSingle<TokenRow>();
  return data ?? null;
}

export async function caConectado(): Promise<boolean> {
  return (await lerConexao()) != null;
}

/** Grava (ou substitui) o par de tokens. Usado pelo callback do OAuth e pelo refresh. */
export async function salvarToken(
  token: { access_token: string; refresh_token?: string; token_type?: string; expires_in?: number; scope?: string },
  opts?: { refreshAnterior?: string | null; por?: string },
): Promise<void> {
  const expiresAt =
    typeof token.expires_in === "number" ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  await supabaseAdmin.from("ca_conexao").upsert(
    {
      id: true,
      access_token: token.access_token,
      // O Cognito pode ou não rotacionar o refresh_token; preserva o antigo se ausente.
      refresh_token: token.refresh_token ?? opts?.refreshAnterior ?? null,
      token_type: token.token_type ?? null,
      scope: token.scope ?? null,
      expires_at: expiresAt,
      atualizado_em: new Date().toISOString(),
      ...(opts?.por ? { conectado_por: opts.por } : {}),
    },
    { onConflict: "id" },
  );
}

async function fazRefresh(refreshToken: string): Promise<string> {
  const chamar = () =>
    fetch(CA_OAUTH.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      cache: "no-store",
    });

  let res = await chamar();
  // O Cognito também aplica rate limit: sob rajada, o refresh estourava e
  // derrubava a tela inteira.
  for (let t = 0; res.status === 429 && t < 4; t++) {
    await sleep(1100 + t * 500);
    res = await chamar();
  }
  if (!res.ok) {
    throw new CaError(`Falha ao renovar o token (HTTP ${res.status}). Reconecte o Conta Azul.`, "auth", res.status);
  }
  const token = (await res.json()) as Parameters<typeof salvarToken>[0];
  await salvarToken(token, { refreshAnterior: refreshToken });
  return token.access_token;
}

/**
 * Deduplica refreshes concorrentes (single-flight).
 *
 * Quando o token expira e várias páginas do sync disparam refresh ao mesmo
 * tempo, só UM POST é feito — as demais aguardam a mesma promise. Sem isso, o
 * Cognito devolve 429 e, pior, o refresh_token é rotacionado a cada chamada:
 * a segunda invalida o que a primeira acabou de gravar, e a conexão cai.
 */
let refreshEmVoo: Promise<string> | null = null;
function refresh(refreshToken: string): Promise<string> {
  if (refreshEmVoo) return refreshEmVoo;
  refreshEmVoo = fazRefresh(refreshToken).finally(() => {
    refreshEmVoo = null;
  });
  return refreshEmVoo;
}

async function tokenFresco(): Promise<string> {
  const row = await lerConexao();
  if (!row) throw new CaError("Conta Azul não conectado.", "sem-conexao");
  const expirado = row.expires_at != null && new Date(row.expires_at).getTime() - SKEW_MS <= Date.now();
  if (expirado && row.refresh_token) return refresh(row.refresh_token);
  return row.access_token;
}

function montarUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${CA_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** GET autenticado. Renova o token e tenta de novo em 401; faz backoff em 429. */
export async function caGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  if (!CA_ENV.clientId || !CA_ENV.clientSecret) {
    throw new CaError("CONTA_AZUL_CLIENT_ID / CLIENT_SECRET não configurados.", "config");
  }
  const url = montarUrl(path, params);
  const chamar = async (token: string) => {
    await throttle();
    return fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
  };

  let token = await tokenFresco();
  let res = await chamar(token);

  // 401 fora do ciclo de expiração (token invalidado do outro lado): renova e retenta.
  if (res.status === 401) {
    const row = await lerConexao();
    if (row?.refresh_token) {
      token = await refresh(row.refresh_token);
      res = await chamar(token);
    }
  }

  // 429: a janela do spike arrest é de 1s, então esperar MENOS que isso só gasta tentativa.
  for (let t = 0; res.status === 429 && t < 4; t++) {
    await sleep(1100 + t * 400);
    res = await chamar(token);
  }

  if (!res.ok) {
    throw new CaError(`Conta Azul respondeu HTTP ${res.status} em ${path}.`, res.status === 401 ? "auth" : "http", res.status);
  }
  return (await res.json()) as T;
}
