/**
 * Mês a mês de vendas — o ano inteiro numa leitura, e o detalhe de um mês.
 *
 * ## O que esta tela responde
 *
 * O painel responde "como está o mês". Esta responde "como o ano vem andando,
 * e o que aconteceu naquele mês que destoou". São perguntas diferentes e por
 * isso o formato é outro: barras por mês, não anel de meta.
 *
 * ## Por que o resumo dos 12 meses e o detalhe de UM mês vêm separados
 *
 * O resumo de cada mês (totais por BU, por vendedor, por categoria) é pequeno
 * e vai inteiro para o navegador: o pop-up de um mês abre instantâneo, sem ida
 * ao servidor. Já a lista venda a venda é grande — mandar a do ano todo seriam
 * centenas de KB para mostrar um mês de cada vez. Então ela vem só do mês
 * escolhido, e trocar de mês é uma navegação.
 *
 * ## ⚠️ `sales.id` não identifica uma venda ao longo do tempo
 *
 * A ponte do Conta Azul apaga e reinsere a janela a cada sync (a cada 15 min,
 * ver `src/lib/ca/normaliza.ts`). O `id` serve de `key` de render e nada mais.
 */
import { unstable_cache } from "next/cache";

import { DASHBOARD_TAG, supabaseAdmin } from "./supabase";
import { fetchAll, listSellers } from "./data";
import { FONTE_PADRAO } from "./fonte";
import { buFromProductLine, productLabel, type BU } from "./products";
import { MES_NOME } from "./vendasMesTipos";
import type { CategoriaDetalhe, Fatia, MesResumo, VendasAno } from "./vendasMesTipos";

/**
 * Nomes de mês e tipos moram em `./vendasMesTipos` — um módulo sem nada de
 * servidor. Reexportados aqui para quem já importava deste arquivo, mas
 * ⚠️ COMPONENTE CLIENTE deve importar de `vendasMesTipos` DIRETO: puxar um
 * valor daqui traz o `supabaseAdmin` junto para o navegador.
 */
export {
  MES_NOME,
  MES_CURTO,
} from "./vendasMesTipos";
export type {
  Fatia,
  MesResumo,
  VendaDetalhe,
  CategoriaDetalhe,
  VendasAno,
} from "./vendasMesTipos";

type Linha = {
  id: string;
  seller_id: string | null;
  sale_date: string;
  product_line: string;
  valor: number | null;
  quantidade: number | null;
};

type SyncInfo = { concluido_em: string | null; erro: string | null } | null;

/**
 * Frescura do espelho. Isolado numa função porque o encadeamento do
 * supabase-js devolve um `PromiseLike`, que não tem `.catch` — e um erro de
 * tipo aqui dentro de um `Promise.all` derruba a inferência de TODOS os outros
 * elementos da tupla, com mensagens que apontam para linhas sem relação.
 */
async function lerSync(): Promise<SyncInfo> {
  try {
    const { data } = await supabaseAdmin
      .from("ca_sync")
      .select("concluido_em, erro")
      .eq("recurso", "vendas")
      .maybeSingle();
    return (data as SyncInfo) ?? null;
  } catch {
    return null;
  }
}

async function calcularAno(year: number, mesSelecionado: number): Promise<VendasAno> {
  const de = `${year}-01-01`;
  const ate = `${year + 1}-01-01`;

  const [linhas, vendedores, sync] = await Promise.all([
    fetchAll<Linha>("sales(ano)", () =>
      supabaseAdmin
        .from("sales")
        .select("id, seller_id, sale_date, product_line, valor, quantidade")
        .eq("origem", FONTE_PADRAO)
        .gte("sale_date", de)
        .lt("sale_date", ate)
        // Ordenação estável e barata. NÃO por `created_at`: nas linhas do Conta
        // Azul ele é a hora do último sync, não a da venda.
        .order("id"),
    ),
    listSellers(),
    lerSync(),
  ]);

  const nomePorId = new Map(vendedores.map((v) => [v.id, v.name]));

  const vazio = (): Record<BU, number> => ({ cppem: 0, unicive: 0, colegio_cppem: 0 });
  const acum = Array.from({ length: 12 }, () => ({
    valor: 0,
    vendas: 0,
    unidades: 0,
    porBu: vazio(),
    vend: new Map<string, Fatia>(),
    cat: new Map<string, Fatia>(),
    dias: new Map<string, { valor: number; vendas: number }>(),
  }));

  const somar = (m: Map<string, Fatia>, chave: string, rotulo: string, valor: number) => {
    const a = m.get(chave) ?? { chave, rotulo, valor: 0, vendas: 0 };
    a.valor += valor;
    a.vendas += 1;
    m.set(chave, a);
  };

  for (const l of linhas) {
    // "2026-11-23" → 11. Fatiar a string evita `new Date()`, que interpretaria
    // a data como UTC e jogaria o dia 1 para o mês anterior no fuso de Recife.
    const mes = Number(l.sale_date.slice(5, 7));
    if (!(mes >= 1 && mes <= 12)) continue;
    const a = acum[mes - 1];
    // `valor` já é o TOTAL da linha — a ponte converte o unitário do Conta
    // Azul (ver `src/lib/ca/normaliza.ts`). Aqui não se multiplica.
    const v = Number(l.valor ?? 0);
    const q = Number(l.quantidade ?? 1);

    a.valor += v;
    a.vendas += 1;
    a.unidades += q;
    a.porBu[buFromProductLine(l.product_line)] += v;
    somar(a.vend, l.seller_id ?? "sem", (l.seller_id && nomePorId.get(l.seller_id)) || "(sem vendedor)", v);
    somar(a.cat, l.product_line, productLabel(l.product_line), v);

    const d = a.dias.get(l.sale_date) ?? { valor: 0, vendas: 0 };
    d.valor += v;
    d.vendas += 1;
    a.dias.set(l.sale_date, d);
  }

  const meses: MesResumo[] = acum.map((a, i) => {
    const anterior = i > 0 ? acum[i - 1].valor : 0;
    let melhorDia: MesResumo["melhorDia"] = null;
    for (const [data, d] of a.dias) {
      if (!melhorDia || d.valor > melhorDia.valor) melhorDia = { data, valor: d.valor, vendas: d.vendas };
    }
    return {
      mes: i + 1,
      rotulo: MES_NOME[i],
      valor: a.valor,
      vendas: a.vendas,
      unidades: a.unidades,
      ticket: a.vendas > 0 ? a.valor / a.vendas : 0,
      porBu: a.porBu,
      porVendedor: [...a.vend.values()].sort((x, y) => y.valor - x.valor),
      porCategoria: [...a.cat.values()].sort((x, y) => y.valor - x.valor),
      melhorDia,
      // Sem base não há variação — 0 → qualquer coisa não é "+∞%", é "sem base".
      variacao: anterior > 0 ? ((a.valor - anterior) / anterior) * 100 : null,
    };
  });

  // ---- Detalhe venda a venda, só do mês escolhido ----
  const mm = String(mesSelecionado).padStart(2, "0");
  const prefixo = `${year}-${mm}-`;
  const porCategoria = new Map<string, CategoriaDetalhe>();
  for (const l of linhas) {
    if (!l.sale_date.startsWith(prefixo)) continue;
    const c = porCategoria.get(l.product_line) ?? {
      chave: l.product_line,
      rotulo: productLabel(l.product_line),
      bu: buFromProductLine(l.product_line),
      valor: 0,
      unidades: 0,
      vendas: [],
    };
    c.valor += Number(l.valor ?? 0);
    c.unidades += Number(l.quantidade ?? 1);
    c.vendas.push({
      id: String(l.id),
      data: l.sale_date,
      vendedor: (l.seller_id && nomePorId.get(l.seller_id)) || "(sem vendedor)",
      valor: Number(l.valor ?? 0),
      quantidade: Number(l.quantidade ?? 1),
    });
    porCategoria.set(l.product_line, c);
  }
  const detalhe = [...porCategoria.values()].sort((a, b) => b.valor - a.valor);
  for (const c of detalhe) {
    // Mais recente primeiro; no mesmo dia, a maior venda no topo.
    c.vendas.sort((a, b) => (a.data === b.data ? b.valor - a.valor : a.data < b.data ? 1 : -1));
  }

  return {
    year,
    meses,
    total: meses.reduce((s, m) => s + m.valor, 0),
    mesSelecionado,
    detalhe,
    sync: { em: sync?.concluido_em ?? null, erro: sync?.erro ?? null },
  };
}

/**
 * O mês a mês, com cache de servidor.
 *
 * ## Por que precisa de cache
 *
 * Esta tela lê o ANO inteiro de `sales` para montar as 12 barras — com o
 * histórico completo no Hub são milhares de linhas, paginadas de mil em mil.
 * Sem cache, cada troca de mês no seletor pagaria essa conta de novo, e o
 * seletor é justamente o que a pessoa fica clicando.
 *
 * ## Duas políticas, porque os anos não são iguais
 *
 * O ano CORRENTE recebe venda nova a cada 15 minutos, então entra com a tag do
 * dashboard: qualquer escrita no Supabase a derruba (ver `fetchWithInvalidation`
 * em `./supabase`), e o número nunca fica velho depois de um sync.
 *
 * Ano PASSADO quase não muda — só quando alguém corrige algo antigo no Conta
 * Azul. Ele fica FORA da tag de propósito: senão toda venda de hoje jogaria
 * fora o cache de 2025, que é o mais caro de montar e o que menos muda. Uma
 * hora de atraso num ano fechado não machuca ninguém.
 *
 * A chave leva `year` E `mes` porque o detalhe venda a venda é do mês escolhido.
 */
export function vendasAno(year: number, mes: number): Promise<VendasAno> {
  const ehCorrente = year >= new Date().getUTCFullYear();
  return unstable_cache(
    () => calcularAno(year, mes),
    [`vendas-ano-v1-${year}-${mes}`],
    ehCorrente
      ? { revalidate: 600, tags: [DASHBOARD_TAG] }
      : { revalidate: 3600 },
  )();
}
