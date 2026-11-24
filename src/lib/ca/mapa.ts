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
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { lerTudo } from "./ler";

/** Piso para sugerir: abaixo disso é palpite, não evidência. */
export const SUGESTAO_MIN_OCORRENCIAS = 5;
export const SUGESTAO_MIN_DOMINANCIA = 0.9;

/**
 * O item PRECISA de classificação?
 *
 * Só quando ele aparece em venda SEM categoria — aí ele é a única fonte da
 * linha de receita. Com categoria, ela resolve, e classificar o item seria
 * trabalho que não produz nada.
 *
 * Medido em 11/11/2026: de 126 itens distintos na janela, **7** importam. Pedir
 * os 126 foi o primeiro desenho desta tela, e era impossível de cumprir.
 */
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
  /**
   * Para ITEM: aparece em venda sem categoria, então classificá-lo muda algo.
   * Para CATEGORIA: sempre true — categoria é a chave principal.
   */
  relevante: boolean;
}

/** Nome legível das categorias, lido das próprias vendas + o mapa já classificado. */
async function nomesDeCategoria(): Promise<Map<string, string>> {
  const data = await lerTudo<{ ca_id: string; ca_nome: string | null }>("ca_mapa_receita", "ca_id, ca_nome", {
    filtrar: (q) => (q as never as { eq: Function }).eq("ca_tipo", "categoria"),
  });
  const m = new Map<string, string>();
  for (const r of data) m.set(r.ca_id, r.ca_nome ?? r.ca_id);
  return m;
}

/**
 * UMA leitura do espelho, agregada e em cache.
 *
 * Antes a tela de Classificacao lia `ca_vendas` 4 vezes e `ca_venda_itens` 3 vezes
 * (sugestoes, volumes, itens relevantes, vendedores), todas paginadas de mil em mil
 * e em sequencia: dezenas de idas ao banco a cada abertura E a cada clique em
 * salvar (que recarrega a pagina). Agora: ca_vendas e ca_venda_itens lidas UMA vez,
 * em paralelo, com tudo que a tela precisa agregado de uma passada, e guardadas por
 * 5 min (ate o proximo sync do espelho, que invalida a tag `ca-espelho`).
 *
 * So entra aqui o que NAO depende da classificacao — a classificacao e aplicada
 * depois, em memoria, sobre estes totais.
 */
export const TAG_ESPELHO = "ca-espelho";

type Vol = { valor: number; vendas: number };
type EspelhoAgregado = {
  /** categoria -> quanto movimentou (so vendas COM categoria) */
  cat: Record<string, Vol>;
  /** item -> quanto movimentou (valor unitario somado, como sempre foi) */
  item: Record<string, Vol>;
  /** item -> em quantas vendas apareceu, por categoria da venda ("_" = venda sem categoria) */
  itemCats: Record<string, Record<string, number>>;
  /** vendedor do Conta Azul -> vendas e valor */
  vendedor: Record<string, Vol>;
};

const agregarEspelho = unstable_cache(
  async (): Promise<EspelhoAgregado> => {
    const [vendas, itens] = await Promise.all([
      lerTudo<{ ca_id: string; categoria_ca_id: string | null; total: number | null; vendedor_ca_id: string | null }>(
        "ca_vendas",
        "ca_id, categoria_ca_id, total, vendedor_ca_id",
      ),
      lerTudo<{ ca_id: string; venda_ca_id: string; item_ca_id: string | null; valor: number | null }>(
        "ca_venda_itens",
        "ca_id, venda_ca_id, item_ca_id, valor",
      ),
    ]);

    const cat: Record<string, Vol> = {};
    const vendedor: Record<string, Vol> = {};
    const catDaVenda = new Map<string, string | null>();
    for (const v of vendas) {
      const c = v.categoria_ca_id ?? null;
      catDaVenda.set(v.ca_id, c);
      if (c) {
        const a = (cat[c] ??= { valor: 0, vendas: 0 });
        a.valor += Number(v.total ?? 0);
        a.vendas += 1;
      }
      if (v.vendedor_ca_id) {
        const a = (vendedor[v.vendedor_ca_id] ??= { valor: 0, vendas: 0 });
        a.valor += Number(v.total ?? 0);
        a.vendas += 1;
      }
    }

    const item: Record<string, Vol> = {};
    const itemCats: Record<string, Record<string, number>> = {};
    for (const it of itens) {
      const id = it.item_ca_id;
      if (!id) continue;
      const a = (item[id] ??= { valor: 0, vendas: 0 });
      a.valor += Number(it.valor ?? 0);
      a.vendas += 1;
      const c = catDaVenda.get(it.venda_ca_id);
      const m = (itemCats[id] ??= {});
      const k = c ?? "_";
      m[k] = (m[k] ?? 0) + 1;
    }
    return { cat, item, itemCats, vendedor };
  },
  ["ca-espelho-agregado-v1"],
  { revalidate: 300, tags: [TAG_ESPELHO] },
);

/** Categoria dominante de cada item (so vendas COM categoria) — e isso que vira sugestao. */
function sugestoesDe(ag: EspelhoAgregado): Map<string, { categoriaCaId: string; ocorrencias: number; dominancia: number }> {
  const out = new Map<string, { categoriaCaId: string; ocorrencias: number; dominancia: number }>();
  for (const [item, m] of Object.entries(ag.itemCats)) {
    const entradas = Object.entries(m).filter(([k]) => k !== "_");
    if (entradas.length === 0) continue;
    const total = entradas.reduce((a, [, n]) => a + n, 0);
    const [melhor, n] = entradas.sort((a, b) => b[1] - a[1])[0];
    out.set(item, { categoriaCaId: melhor, ocorrencias: n, dominancia: total ? n / total : 0 });
  }
  return out;
}

/**
 * Itens cuja classificacao muda alguma coisa: os que aparecem em venda que a
 * CATEGORIA nao resolve (sem categoria, ou categoria sem linha e nao ignorada).
 */
function itensRelevantes(
  ag: EspelhoAgregado,
  classificadas: Map<string, { product_line: string | null; ignorar: boolean }>,
): Set<string> {
  const out = new Set<string>();
  for (const [item, m] of Object.entries(ag.itemCats)) {
    for (const k of Object.keys(m)) {
      const c = k === "_" ? undefined : classificadas.get(k);
      if (!(c && (c.product_line || c.ignorar))) {
        out.add(item);
        break;
      }
    }
  }
  return out;
}

export async function listarMapa(): Promise<{ categorias: LinhaMapa[]; itens: LinhaMapa[] }> {
  const linhas = await lerTudo<Record<string, unknown>>("ca_mapa_receita", "*");
  // A relevância de um item depende de quais CATEGORIAS já resolvem a linha,
  // então o mapa é lido antes — não em paralelo com quem precisa dele.
  const classificadas = new Map<string, { product_line: string | null; ignorar: boolean }>(
    linhas
      .filter((l) => l.ca_tipo === "categoria")
      .map((l) => [l.ca_id as string, { product_line: (l.product_line as string) ?? null, ignorar: !!l.ignorar }]),
  );
  const ag = await agregarEspelho();
  const nomes = new Map<string, string>();
  for (const l of linhas) if (l.ca_tipo === "categoria") nomes.set(l.ca_id as string, (l.ca_nome as string) ?? (l.ca_id as string));
  const sug = sugestoesDe(ag);
  const vol = {
    cat: new Map(Object.entries(ag.cat)),
    item: new Map(Object.entries(ag.item)),
  };
  const relevantes = itensRelevantes(ag, classificadas);

  const montar = (tipo: "categoria" | "item"): LinhaMapa[] =>
    linhas
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
          relevante: tipo === "categoria" || relevantes.has(id),
        };
      })
      // Pendente primeiro, e dentro disso o que move mais dinheiro.
      .sort((a, b) => {
        // Relevante primeiro; dentro disso, não-classificado; depois o que move mais.
        if (a.relevante !== b.relevante) return a.relevante ? -1 : 1;
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
  const [mapa, ag] = await Promise.all([
    lerTudo<Record<string, unknown>>("ca_vendedores", "*", { ordenarPor: "ca_vendedor_id" }),
    agregarEspelho(),
  ]);
  const agg = new Map(Object.entries(ag.vendedor));

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
