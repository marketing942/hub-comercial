import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { listarMapa, listarVendedores } from "@/lib/ca/mapa";
import { palpitarCategoria, palpitarVendedor } from "@/lib/ca/sugestao";
import { listSellers } from "@/lib/data";
import {
  COLEGIO_PRODUCT_IDS,
  CPPEM_PRODUCT_IDS,
  UNICIVE_PRODUCT_IDS,
} from "@/lib/products";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LINHAS = new Set<string>([...CPPEM_PRODUCT_IDS, ...UNICIVE_PRODUCT_IDS, ...COLEGIO_PRODUCT_IDS]);

/**
 * Aplica TODAS as sugestoes de uma vez.
 *
 * ## Por que esta rota existe
 *
 * A tela mostrava as sugestoes pre-preenchidas nos campos, mas aquilo era so
 * estado do formulario: so gravava ao clicar o visto de cada linha. Quem olhava
 * via tudo preenchido, mandava reprocessar e recebia zero — uma tela que
 * aparenta estar pronta e nao esta e pior que uma tela vazia. Aconteceu em
 * 11/11/2026, com R$ 414 mil parados em pendencia.
 *
 * ## O palpite e recalculado AQUI
 *
 * Nao recebe nada do cliente. O servidor le o mapa, roda a mesma funcao de
 * sugestao e grava. Assim o que e aplicado e exatamente o que a regra diz — e
 * nao o que um formulario desatualizado tinha na tela.
 *
 * ## Nunca sobrescreve decisao humana
 *
 * So toca linha que ainda esta pendente. Classificacao ja feita fica como esta,
 * mesmo que a sugestao discorde dela.
 */
export async function POST() {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });

  const [mapa, vendedores, sellers] = await Promise.all([
    listarMapa(),
    listarVendedores(),
    listSellers(),
  ]);

  const agora = new Date().toISOString();
  let categorias = 0;
  let itens = 0;
  let vends = 0;
  const semSugestao: string[] = [];

  // ---- categorias -------------------------------------------------------
  for (const c of mapa.categorias) {
    if (c.product_line || c.ignorar) continue;
    const p = palpitarCategoria(c.ca_nome);
    if (!p || (!p.product_line && !p.ignorar && !p.bu)) {
      semSugestao.push(c.ca_nome ?? c.ca_id);
      continue;
    }
    // Linha invalida nunca entra: buFromProductLine manda desconhecido para o
    // CPPEM sem erro, e viraria faturamento da BU errada em silencio.
    const linha = p.product_line && LINHAS.has(p.product_line) ? p.product_line : null;
    const { error } = await supabaseAdmin.from("ca_mapa_receita").upsert(
      {
        ca_tipo: "categoria",
        ca_id: c.ca_id,
        bu: p.bu || null,
        product_line: linha,
        conta_vendedor: p.conta_vendedor,
        ignorar: p.ignorar,
        classificado_em: agora,
        classificado_por: "sugestao-aplicada",
      },
      { onConflict: "ca_tipo,ca_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    categorias++;
  }

  // ---- itens relevantes, pela categoria dominante do historico -----------
  const nomeCat = new Map(mapa.categorias.map((c) => [c.ca_id, c.ca_nome]));
  for (const i of mapa.itens) {
    if (!i.relevante || i.product_line || i.ignorar || !i.sugestao) continue;
    const p = palpitarCategoria(nomeCat.get(i.sugestao.categoriaCaId) ?? i.sugestao.nome);
    if (!p) continue;
    const linha = p.product_line && LINHAS.has(p.product_line) ? p.product_line : null;
    if (!linha && !p.ignorar) {
      semSugestao.push(i.ca_nome ?? i.ca_id);
      continue;
    }
    const { error } = await supabaseAdmin.from("ca_mapa_receita").upsert(
      {
        ca_tipo: "item",
        ca_id: i.ca_id,
        bu: p.bu || null,
        product_line: linha,
        conta_vendedor: p.conta_vendedor,
        ignorar: p.ignorar,
        classificado_em: agora,
        classificado_por: "sugestao-aplicada",
      },
      { onConflict: "ca_tipo,ca_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    itens++;
  }

  // ---- vendedores -------------------------------------------------------
  const lista = sellers.map((x) => ({ id: x.id, name: x.name }));
  for (const v of vendedores) {
    if (v.destino !== "pendente") continue;
    const p = palpitarVendedor(v.ca_nome, lista);
    if (!p) {
      semSugestao.push(v.ca_nome ?? v.ca_vendedor_id);
      continue;
    }
    const { error } = await supabaseAdmin
      .from("ca_vendedores")
      .update({ destino: p.destino, seller_id: p.destino === "vendedor" ? p.sellerId : null })
      .eq("ca_vendedor_id", v.ca_vendedor_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    vends++;
  }

  return NextResponse.json({ ok: true, categorias, itens, vendedores: vends, semSugestao });
}
