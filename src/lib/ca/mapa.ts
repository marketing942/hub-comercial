/**
 * O mapa de classificação: leitura para a tela e a sugestão automática.
 *
 * ## A sugestão existe, a decisão não é dela
 *
 * Venda que nasce no site chega **sem categoria** — e o nome do item não é
 * taxonomia (`MENSALIDADE - 6º Ano` e `EBOOK - MENSAL COLÉGIO 6 FUND` são a
 * mesma coisa com nomes diferentes). Mas o dado resolve por outro caminho: o
 * MESMO item costuma estar categorizado corretamente em outras vendas. Medido
 * nesta conta: `EBK - TECNO UNICIVE` aparece 1.304 vezes com `1.5 Matrícula
 * Unicive` (98,9%) — e é exatamente o item das 70 vendas sem categoria de dois
 * vendedores em novembro.
 *
 * Então a sugestão PRÉ-PREENCHE a tela, e um humano confirma. Ela **não** é
 * regra de runtime: uma votação por maioria rodando para sempre muda de resposta
 * sozinha no dia em que alguém lançar um lote errado — e muda em silêncio.
 */
import { supabaseAdmin } from "@/lib/supabase";

/** Piso para sugerir: abaixo disso é palpite, não evidência. */
export const SUGESTAO_MIN_OCORRENCIAS = 5;
export const SUGESTAO_MIN_DOMINANCIA = 0.9;

export interface LinhaMapa {
  ca_tipo: "categoria" | "item";
  ca_id: string;
  ca_nome: string | null;
  bu: string | null;
  product_line: string | null;
  conta_vendedor: boolean;
  ignorar: boolean;
  classificado_em: string | null;
  /** Quanto este item/categoria movimentou — para classificar o que importa primeiro. */
  valor: number;
  vendas: number;
  /** Categoria dominante no histórico deste ITEM (só para pendentes). */
  sugestao: { categoriaCaId: string; nome: string; ocorrencias: number; dominancia: number } | null;
}

/** Nome legível das categorias, lido das próprias vendas + o mapa já classificado. */
async function nomesDeCategoria(): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from("ca_mapa_receita")
    .select("ca_id, ca_nome")
    .eq("ca_tipo", "categoria")
    .limit(2000);
  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(r.ca_id as string, (r.ca_nome as string) ?? (r.ca_id as string));
  return m;
}

/**
 * Para cada item, a categoria dominante nas vendas em que ele aparece COM
 * categoria. É isto que vira sugestão.
 */
async function sugestoesPorItem(): Promise<Map<string, { categoriaCaId: string; ocorrencias: number; dominancia: number }>> {
  const vendas = new Map<string, string | null>();
  for (let f = 0; ; f += 1000) {
    const { data } = await supabaseAdmin
      .from("ca_vendas")
      .select("ca_id, categoria_ca_id")
      .order("ca_id")
      .range(f, f + 999);
    for (const v of data ?? []) vendas.set(v.ca_id as string, (v.categoria_ca_id as string) ?? null);
    if ((data ?? []).length < 1000) break;
  }

  const contagem = new Map<string, Map<string, number>>();
  for (let f = 0; ; f += 1000) {
    const { data } = await supabaseAdmin
      .from("ca_venda_itens")
      .select("venda_ca_id, item_ca_id")
      .order("ca_id")
      .range(f, f + 999);
    for (const it of data ?? []) {
      const item = it.item_ca_id as string | null;
      const cat = vendas.get(it.venda_ca_id as string);
      if (!item || !cat) continue;
      const m = contagem.get(item) ?? new Map<string, number>();
      m.set(cat, (m.get(cat) ?? 0) + 1);
      contagem.set(item, m);
    }
    if ((data ?? []).length < 1000) break;
  }

  const out = new Map<string, { categoriaCaId: string; ocorrencias: number; dominancia: number }>();
  for (const [item, m] of contagem) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const [melhor, n] = [...m].sort((a, b) => b[1] - a[1])[0];
    out.set(item, { categoriaCaId: melhor, ocorrencias: n, dominancia: total ? n / total : 0 });
  }
  return out;
}

/** Quanto cada categoria e cada item movimentaram, para ordenar a fila. */
async function volumes(): Promise<{ cat: Map<string, { valor: number; vendas: number }>; item: Map<string, { valor: number; vendas: number }> }> {
  const cat = new Map<string, { valor: number; vendas: number }>();
  const item = new Map<string, { valor: number; vendas: number }>();

  const vendas = new Map<string, { cat: string | null; total: number }>();
  for (let f = 0; ; f += 1000) {
    const { data } = await supabaseAdmin
      .from("ca_vendas")
      .select("ca_id, categoria_ca_id, total")
      .order("ca_id")
      .range(f, f + 999);
    for (const v of data ?? []) {
      vendas.set(v.ca_id as string, { cat: (v.categoria_ca_id as string) ?? null, total: Number(v.total ?? 0) });
      const c = (v.categoria_ca_id as string) ?? null;
      if (c) {
        const a = cat.get(c) ?? { valor: 0, vendas: 0 };
        a.valor += Number(v.total ?? 0);
        a.vendas += 1;
        cat.set(c, a);
      }
    }
    if ((data ?? []).length < 1000) break;
  }

  for (let f = 0; ; f += 1000) {
    const { data } = await supabaseAdmin
      .from("ca_venda_itens")
      .select("item_ca_id, valor")
      .order("ca_id")
      .range(f, f + 999);
    for (const it of data ?? []) {
      const id = it.item_ca_id as string | null;
      if (!id) continue;
      const a = item.get(id) ?? { valor: 0, vendas: 0 };
      a.valor += Number(it.valor ?? 0);
      a.vendas += 1;
      item.set(id, a);
    }
    if ((data ?? []).length < 1000) break;
  }

  return { cat, item };
}

export async function listarMapa(): Promise<{ categorias: LinhaMapa[]; itens: LinhaMapa[] }> {
  const [{ data: linhas }, nomes, sug, vol] = await Promise.all([
    supabaseAdmin.from("ca_mapa_receita").select("*").limit(5000),
    nomesDeCategoria(),
    sugestoesPorItem(),
    volumes(),
  ]);

  const montar = (tipo: "categoria" | "item"): LinhaMapa[] =>
    (linhas ?? [])
      .filter((l) => l.ca_tipo === tipo)
      .map((l) => {
        const id = l.ca_id as string;
        const v = (tipo === "categoria" ? vol.cat : vol.item).get(id) ?? { valor: 0, vendas: 0 };
        const s = tipo === "item" ? sug.get(id) : undefined;
        const classificado = !!l.product_line || !!l.ignorar;
        return {
          ca_tipo: tipo,
          ca_id: id,
          ca_nome: (l.ca_nome as string) ?? null,
          bu: (l.bu as string) ?? null,
          product_line: (l.product_line as string) ?? null,
          conta_vendedor: !!l.conta_vendedor,
          ignorar: !!l.ignorar,
          classificado_em: (l.classificado_em as string) ?? null,
          valor: v.valor,
          vendas: v.vendas,
          sugestao:
            !classificado && s && s.ocorrencias >= SUGESTAO_MIN_OCORRENCIAS && s.dominancia >= SUGESTAO_MIN_DOMINANCIA
              ? {
                  categoriaCaId: s.categoriaCaId,
                  nome: nomes.get(s.categoriaCaId) ?? s.categoriaCaId,
                  ocorrencias: s.ocorrencias,
                  dominancia: s.dominancia,
                }
              : null,
        };
      })
      // Pendente primeiro, e dentro disso o que move mais dinheiro.
      .sort((a, b) => {
        const pa = a.product_line || a.ignorar ? 1 : 0;
        const pb = b.product_line || b.ignorar ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return b.valor - a.valor;
      });

  return { categorias: montar("categoria"), itens: montar("item") };
}

export interface VendedorMapa {
  ca_vendedor_id: string;
  ca_nome: string | null;
  destino: "vendedor" | "canal_direto" | "grupo" | "pendente";
  seller_id: string | null;
  vendas: number;
  valor: number;
}

export async function listarVendedores(): Promise<VendedorMapa[]> {
  const [{ data: mapa }, agg] = await Promise.all([
    supabaseAdmin.from("ca_vendedores").select("*").limit(2000),
    (async () => {
      const m = new Map<string, { vendas: number; valor: number }>();
      for (let f = 0; ; f += 1000) {
        const { data } = await supabaseAdmin
          .from("ca_vendas")
          .select("vendedor_ca_id, total")
          .order("ca_id")
          .range(f, f + 999);
        for (const v of data ?? []) {
          const id = v.vendedor_ca_id as string | null;
          if (!id) continue;
          const a = m.get(id) ?? { vendas: 0, valor: 0 };
          a.vendas += 1;
          a.valor += Number(v.total ?? 0);
          m.set(id, a);
        }
        if ((data ?? []).length < 1000) break;
      }
      return m;
    })(),
  ]);

  return (mapa ?? [])
    .map((v) => ({
      ca_vendedor_id: v.ca_vendedor_id as string,
      ca_nome: (v.ca_nome as string) ?? null,
      destino: (v.destino as VendedorMapa["destino"]) ?? "pendente",
      seller_id: (v.seller_id as string) ?? null,
      ...(agg.get(v.ca_vendedor_id as string) ?? { vendas: 0, valor: 0 }),
    }))
    .sort((a, b) => {
      const pa = a.destino === "pendente" ? 0 : 1;
      const pb = b.destino === "pendente" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.valor - a.valor;
    });
}
