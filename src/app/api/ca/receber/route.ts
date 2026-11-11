import { NextResponse, type NextRequest } from "next/server";

import { descobrirPendencias } from "@/lib/ca/espelho";
import { gravarEspelho } from "@/lib/ca/recebido";
import { normalizarJanela } from "@/lib/ca/normaliza";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
// Grava o espelho + descobre pendencias + normaliza a janela, tudo numa chamada.
export const maxDuration = 300;

/**
 * RECEBE o espelho do Conta Azul que o Jarvis empurra.
 *
 * ## Por que o endereco exposto e este, e nao o do Jarvis
 *
 * O Hub nao consegue falar com a API v2 do Conta Azul (um aplicativo do portal
 * aceita UMA url de redirecionamento, e app "de producao" nao e reconhecido pelo
 * Cognito). Alguem tem que atravessar a ponte.
 *
 * A primeira versao era o Hub puxando de uma rota no Jarvis. Foi descartada por
 * decisao do requisitante, e a razao e boa: o Jarvis tem os dados de TODA a
 * empresa e o Hub tem faturamento comercial. Entre os dois, o endpoint publico
 * fica aqui — se o segredo vazar, vaza o lado que tem menos a perder.
 *
 * ## Protecao
 *
 * Header `x-ponte-secret` == `JARVIS_PONTE_SECRET`. Sem a variavel definida a
 * rota responde 503, nunca 200 sem conferir: segredo ausente nao pode virar
 * "rota aberta" — foi assim que o SESSION_SECRET com fallback publico deixou
 * qualquer pessoa forjar cookie de admin neste mesmo sistema.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.JARVIS_PONTE_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: "JARVIS_PONTE_SECRET nao configurado." }, { status: 503 });
  }
  if (req.headers.get("x-ponte-secret") !== segredo) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  let corpo: { de?: string; ate?: string; vendas?: unknown[]; itens?: unknown[]; categorias?: unknown[] };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const { de, ate } = corpo;
  if (!de || !ate || !ISO.test(de) || !ISO.test(ate) || de > ate) {
    return NextResponse.json({ error: "Informe `de` e `ate` em AAAA-MM-DD." }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const espelho = await gravarEspelho(de, ate, corpo.vendas ?? [], corpo.itens ?? [], corpo.categorias ?? []);
    const pend = await descobrirPendencias();
    const norm = await normalizarJanela(de, ate);

    const resumo = { de, ate, espelho, pendenciasDescobertas: pend, normalizacao: norm, ms: Date.now() - t0 };
    await supabaseAdmin.from("ca_sync").upsert(
      {
        recurso: "vendas",
        iniciado_em: new Date(t0).toISOString(),
        concluido_em: new Date().toISOString(),
        lidos: espelho.vendas,
        gravados: norm.paraSales + norm.paraDireto + norm.paraGrupo,
        erro: null,
        resumo: resumo as unknown as Record<string, unknown>,
      },
      { onConflict: "recurso" },
    );
    return NextResponse.json({ ok: true, ...resumo });
  } catch (e) {
    const msg = (e as Error).message;
    await supabaseAdmin
      .from("ca_sync")
      .upsert({ recurso: "vendas", concluido_em: new Date().toISOString(), erro: msg }, { onConflict: "recurso" });
    // 500 de verdade: um 200 com erro no corpo faria o Jarvis marcar sucesso.
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
