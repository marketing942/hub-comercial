/**
 * Grava no espelho local o que o Jarvis empurrou.
 *
 * ## Troca completa da janela
 *
 * Apaga e regrava, em vez de só inserir. Venda cancelada some do lado do Jarvis
 * e precisa sumir daqui também — só inserir deixaria a linha viva para sempre, e
 * reprocessar o que mudou não desfaz o que já foi gravado. O mesmo mecanismo
 * cobre item removido da venda.
 *
 * Isto só mexe em `ca_vendas` e `ca_venda_itens`, que são tabelas do espelho.
 * Quem decide o que vira faturamento é `./normaliza.ts`, e é lá que mora a
 * invariante de nunca tocar linha manual.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { revalidateTag } from "next/cache";
import { lerTudo } from "./ler";
import { ehCategoriaDeReceita, nomeDaCategoria } from "./categoriaReceita";
import { TAG_ESPELHO } from "./mapa";

export interface ResultadoEspelho {
  vendas: number;
  itens: number;
  /** Categorias cujo NOME o Jarvis mandou — é o que torna a tela classificável. */
  categorias: number;
  /** Itens órfãos removidos: a venda deles não veio mais (cancelada, por exemplo). */
  orfaosRemovidos: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export async function gravarEspelho(
  de: string,
  ate: string,
  vendasRaw: unknown[],
  itensRaw: unknown[],
  categoriasRaw: unknown[] = [],
): Promise<ResultadoEspelho> {
  const agora = new Date().toISOString();

  /**
   * Normaliza o que chegou pela rede.
   *
   * O payload vem de outro sistema: tratar como dado, não como objeto confiável.
   * Linha sem `ca_id` é descartada em vez de virar uma chave vazia que colide
   * com a próxima.
   */
  const vendas = (vendasRaw as Record<string, unknown>[])
    .filter((v) => txt(v?.ca_id))
    .map((v) => ({
      ca_id: txt(v.ca_id)!,
      numero: num(v.numero),
      data: txt(v.data),
      situacao: txt(v.situacao),
      total: num(v.total),
      versao: num(v.versao),
      cliente_ca_id: txt(v.cliente_ca_id),
      ca_criado_em: txt(v.ca_criado_em),
      ca_alterado_em: txt(v.ca_alterado_em),
      vendedor_ca_id: txt(v.vendedor_ca_id),
      vendedor_nome: txt(v.vendedor_nome),
      categoria_ca_id: txt(v.categoria_ca_id),
      detalhe_versao: num(v.detalhe_versao),
      detalhe_em: agora,
      visto_em: agora,
    }));

  const vivos = new Set(vendas.map((v) => v.ca_id));
  const itens = (itensRaw as Record<string, unknown>[])
    .filter((i) => txt(i?.ca_id) && txt(i?.venda_ca_id) && vivos.has(txt(i.venda_ca_id)!))
    .map((i) => ({
      ca_id: txt(i.ca_id)!,
      venda_ca_id: txt(i.venda_ca_id)!,
      item_ca_id: txt(i.item_ca_id),
      nome: txt(i.nome),
      tipo: txt(i.tipo),
      quantidade: num(i.quantidade) ?? 1,
      valor: num(i.valor) ?? 0,
    }));

  // ---- apaga a janela antes de regravar -------------------------------
  {
    const { error } = await supabaseAdmin.from("ca_vendas").delete().gte("data", de).lte("data", ate);
    if (error) throw new Error(`limpar ca_vendas: ${error.message}`);
  }

  // ---- regrava --------------------------------------------------------
  for (let i = 0; i < vendas.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("ca_vendas")
      .upsert(vendas.slice(i, i + 500), { onConflict: "ca_id" });
    if (error) throw new Error(`gravar ca_vendas: ${error.message}`);
  }
  for (let i = 0; i < itens.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("ca_venda_itens")
      .upsert(itens.slice(i, i + 500), { onConflict: "ca_id" });
    if (error) throw new Error(`gravar ca_venda_itens: ${error.message}`);
  }

  /**
   * Itens não têm data própria, então a janela não os alcança: remove os que
   * ficaram sem venda viva. Sem isto, o item de uma venda cancelada continuaria
   * no espelho e voltaria a virar faturamento na próxima normalização.
   *
   * ⚠️ ÓRFÃO É ITEM SEM VENDA NA TABELA — não "item fora deste empurrão".
   *
   * Até 2026-11-23 a comparação era contra `vivos`, o conjunto de vendas do
   * payload ATUAL. Com um empurrão só por rodada isso parecia certo e funcionou
   * por meses. Quebrou no dia em que a ponte passou a mandar o histórico em
   * FATIAS: cada fatia apagava os itens de todas as outras, e ao fim de seis
   * fatias o espelho tinha 6.770 vendas e 1.897 itens.
   *
   * O estrago não aparece de imediato — `sales` continua certo, porque cada
   * fatia normaliza enquanto os seus itens ainda estão lá. Ele aparece DEPOIS:
   * reprocessar um mês antigo pela tela de Classificação leria zero itens e
   * apagaria o faturamento daquele mês.
   *
   * Agora a referência é a própria `ca_vendas`, que é onde "venda viva" mora.
   * Fica correto para um empurrão ou para cem, e independe da ordem das fatias.
   *
   * Roda DEPOIS da regravação das duas tabelas, e não antes: no meio do
   * caminho as vendas da janela já foram apagadas e ainda não voltaram, então
   * ali TODO item da janela pareceria órfão.
   */
  let orfaosRemovidos = 0;
  {
    // PAGINADO — `.limit(50000)` era cortado em 1.000 e deixava órfão para trás.
    const data = await lerTudo<{ ca_id: string; venda_ca_id: string }>("ca_venda_itens", "ca_id, venda_ca_id");
    const todasAsVendas = await lerTudo<{ ca_id: string }>("ca_vendas", "ca_id");
    const existentes = new Set(todasAsVendas.map((v) => v.ca_id));
    const orfaos = data.filter((o) => !existentes.has(o.venda_ca_id)).map((o) => o.ca_id);
    for (let i = 0; i < orfaos.length; i += 300) {
      const { error } = await supabaseAdmin
        .from("ca_venda_itens")
        .delete()
        .in("ca_id", orfaos.slice(i, i + 300));
      if (error) throw new Error(`limpar itens órfãos: ${error.message}`);
    }
    orfaosRemovidos = orfaos.length;
  }

  /**
   * Nomes das categorias → `ca_mapa_receita.ca_nome`.
   *
   * O upsert leva SÓ a chave e o nome. O PostgREST faz `DO UPDATE SET` apenas
   * nas colunas enviadas, então classificação já feita (bu, product_line,
   * conta_vendedor, ignorar) não é tocada — atualizar o nome nunca pode
   * desclassificar nada.
   */
  /**
   * SÓ as categorias que aparecem nas vendas desta janela.
   *
   * O Jarvis manda o cadastro inteiro de `fin_categorias` — 113 linhas, a maior
   * parte DESPESA ("Salário", "IPTU", "FGTS", "Honorários Contábeis"). Sem este
   * filtro elas entram na fila de classificação e alguém é convidado a dizer a
   * que BU pertence o IPTU. Aconteceu na primeira rodada: 12 categorias viraram
   * 40.
   *
   * Filtrar aqui, e não no Jarvis, porque é o Hub que sabe quais categorias as
   * SUAS vendas usam — e assim a correção não exige um rebuild do Jarvis.
   */
  const usadas = new Set(vendas.map((v) => v.categoria_ca_id).filter(Boolean) as string[]);
  /**
   * Alem das usadas nas vendas da janela, TODA categoria de RECEITA do Conta Azul,
   * mesmo sem venda: nao da para classificar nem dar meta ao que nao se ve.
   * A regra vive em `./categoriaReceita.ts`.
   */
  const categorias = (categoriasRaw as Record<string, unknown>[])
    .filter((c) => txt(c?.ca_id) && (usadas.has(txt(c.ca_id)!) || ehCategoriaDeReceita(txt(c.codigo), txt(c.nome))))
    .map((c) => ({
      ca_tipo: "categoria" as const,
      ca_id: txt(c.ca_id)!,
      ca_nome: nomeDaCategoria(txt(c.codigo), txt(c.nome)),
    }))
    .filter((c) => c.ca_nome);

  for (let i = 0; i < categorias.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("ca_mapa_receita")
      .upsert(categorias.slice(i, i + 500), { onConflict: "ca_tipo,ca_id" });
    if (error) throw new Error(`nomes de categoria: ${error.message}`);
  }

  // O espelho mudou: o agregado da tela de Classificacao (em cache) fica velho.
  try {
    revalidateTag(TAG_ESPELHO);
  } catch {
    /* fora de rota: nada a invalidar */
  }

  return { vendas: vendas.length, itens: itens.length, categorias: categorias.length, orfaosRemovidos };
}
