/**
 * Gestao a Vista — o faturamento da EMPRESA no mes, todas as linhas de receita
 * do Conta Azul.
 *
 * ## Uma fonte so: a categoria do Conta Azul
 *
 * Cada item valido do Conta Azul e UMA linha em `ca_linha_receita` (gravada pela
 * normalizacao, ver `src/lib/ca/normaliza.ts`), com a categoria do PROPRIO Conta
 * Azul, a BU e a origem. Esta tela le so essa tabela — nao depende de ninguem ter
 * ligado item a "linha do Hub", e por isso nao perde receita: o total fecha com o
 * do Conta Azul (so ficam de fora venda cancelada e o que foi marcado "ignorar").
 *
 * ## As 3 origens
 *
 *  - vendedores: conta p/ vendedor E o vendedor do Conta Azul esta ligado a um
 *    vendedor do Hub (ou a BU tem um vendedor so)
 *  - direto:     conta p/ vendedor mas a venda e do canal direto (site)
 *  - diretoria:  nao conta p/ vendedor (mensalidade, repasse, fardamento, livros...)
 *                ou conta mas chegou sem dono
 * A classificacao de VENDEDORES (Configuracoes > Classificacao) continua sendo o
 * que separa as tres.
 */
import { unstable_cache } from "next/cache";

import { DASHBOARD_TAG, supabaseAdmin } from "./supabase";
import { fetchAll } from "./data";
import { nowRecife } from "./calc";
import {
  vazioBu,
  vazioOrigem,
  type BuKey,
  type DiaGestao,
  type GestaoMes,
  type LinhaCategoria,
  type Origem,
} from "./gestaoAVistaTipos";

type Linha = {
  sale_date: string;
  valor: number | null;
  categoria_id: string | null;
  categoria_nome: string;
  bu: string | null;
  origem: Origem;
  sem_dono: boolean | null;
};

const BUS_VALIDAS = new Set<string>(["cppem", "unicive", "colegio_cppem"]);

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * `mes` = um mes (barras por DIA) ou `null` = o ano inteiro (barras por MES).
 * Mesmo agregador nos dois: so muda o intervalo e o tamanho do balde.
 */
async function calcular(year: number, mes: number | null): Promise<GestaoMes> {
  const anual = mes === null;
  const mm = anual ? "01" : String(mes).padStart(2, "0");
  const de = `${year}-${mm}-01`;
  const prox = anual
    ? `${year + 1}-01-01`
    : mes === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mes + 1).padStart(2, "0")}-01`;
  const totalDias = anual ? 12 : new Date(year, mes, 0).getDate();

  let semTabela = false;
  // So as 2 leituras que a tela usa. (A "conferencia" com ca_vendas e o
  // ca_sync sairam: o GAV nao mostra mais; o horario do sync vem do carrossel.)
  const [linhas, metas] = await Promise.all([
    (async () => {
      try {
        return await fetchAll<Linha>(
          "gestao(ca_linha_receita)",
          () =>
            supabaseAdmin
              .from("ca_linha_receita")
              .select("sale_date, valor, categoria_id, categoria_nome, bu, origem, sem_dono")
              .gte("sale_date", de)
              .lt("sale_date", prox)
              .order("ca_venda_id")
              .order("ca_item_id"),
          true,
        );
      } catch {
        semTabela = true;
        return [] as Linha[];
      }
    })(),
    (async () => {
      // Metas por linha (etapa 2): somadas por categoria; sem a tabela, sem metas.
      // A BU vem junto: e ela que monta a meta por BU e a meta total da empresa.
      const m = new Map<string, { valor: number; bu: string }>();
      try {
        let q = supabaseAdmin.from("ca_metas_linha").select("bu, categoria_id, valor_meta").eq("year", year);
        if (!anual) q = q.eq("month", mes);
        const { data } = await q;
        for (const r of (data as { bu: string; categoria_id: string; valor_meta: number }[]) ?? []) {
          const a = m.get(r.categoria_id) ?? { valor: 0, bu: r.bu };
          a.valor += Number(r.valor_meta ?? 0);
          m.set(r.categoria_id, a);
        }
      } catch {
        /* sem metas */
      }
      return m;
    })(),
  ]);

  const dias: DiaGestao[] = Array.from({ length: totalDias }, (_, i) => ({
    dia: i + 1,
    rotulo: anual ? MES_ABREV[i] : undefined,
    data: anual ? `${year}-${String(i + 1).padStart(2, "0")}` : `${year}-${mm}-${String(i + 1).padStart(2, "0")}`,
    total: 0,
    origem: vazioOrigem(),
    bu: vazioBu(),
    categoria: {},
    acumulado: null,
  }));
  const porOrigem = vazioOrigem();
  const porBu = vazioBu();
  let semDono = 0;
  const cats = new Map<string, LinhaCategoria>();

  for (const l of linhas) {
    const v = Number(l.valor ?? 0);
    const bu: BuKey = l.bu && BUS_VALIDAS.has(l.bu) ? (l.bu as BuKey) : "grupo";
    // A categoria e a do Conta Azul; o nome identifica (o id pode faltar).
    const chave = l.categoria_id ?? `nome:${l.categoria_nome}`;
    const d = Number(l.sale_date.slice(anual ? 5 : 8, anual ? 7 : 10));
    if (d >= 1 && d <= totalDias) {
      const dia = dias[d - 1];
      dia.total += v;
      dia.origem[l.origem] += v;
      dia.bu[bu] += v;
      dia.categoria[chave] = (dia.categoria[chave] ?? 0) + v;
    }
    porOrigem[l.origem] += v;
    porBu[bu] += v;
    if (l.sem_dono) semDono += v;
    let c = cats.get(chave);
    if (!c) {
      c = { chave, rotulo: l.categoria_nome, bu, valor: 0, origem: vazioOrigem(), metaValor: metas.get(chave)?.valor ?? 0 };
      cats.set(chave, c);
    }
    c.valor += v;
    c.origem[l.origem] += v;
  }

  // Linha com meta e sem nenhuma venda no periodo tambem aparece (0% da meta):
  // e justamente a que mais precisa de atencao. O nome vem do mapa do Conta Azul.
  const semVenda = [...metas].filter(([id, m]) => m.valor > 0 && !cats.has(id));
  if (semVenda.length) {
    const nomes = new Map<string, string>();
    try {
      const { data } = await supabaseAdmin
        .from("ca_mapa_receita")
        .select("ca_id, ca_nome")
        .eq("ca_tipo", "categoria")
        .in("ca_id", semVenda.map(([id]) => id));
      for (const r of (data as { ca_id: string; ca_nome: string | null }[]) ?? []) nomes.set(r.ca_id, r.ca_nome ?? "");
    } catch {
      /* sem nomes: cai no id */
    }
    for (const [id, m] of semVenda) {
      const bu: BuKey = BUS_VALIDAS.has(m.bu) ? (m.bu as BuKey) : "grupo";
      cats.set(id, { chave: id, rotulo: nomes.get(id) || `Categoria ${id.slice(0, 8)}`, bu, valor: 0, origem: vazioOrigem(), metaValor: m.valor });
    }
  }

  const metaPorBu = vazioBu();
  let metaTotal = 0;
  for (const m of metas.values()) {
    const bu: BuKey = BUS_VALIDAS.has(m.bu) ? (m.bu as BuKey) : "grupo";
    metaPorBu[bu] += m.valor;
    metaTotal += m.valor;
  }

  const metaPorOrigem = await distribuirMetaPorOrigem(metas, de);

  // Acumulado: para no dia de hoje se o mes e o corrente (dia futuro nao tem dado).
  const hoje = nowRecife();
  const ehCorrente = anual ? hoje.getFullYear() === year : hoje.getFullYear() === year && hoje.getMonth() + 1 === mes;
  const ate = !ehCorrente ? totalDias : anual ? hoje.getMonth() + 1 : hoje.getDate();
  let corrente = 0;
  for (const d of dias) {
    corrente += d.total;
    d.acumulado = d.dia <= ate ? corrente : null;
  }

  return {
    year,
    mes,
    anual,
    total: porOrigem.vendedores + porOrigem.direto + porOrigem.diretoria,
    metaTotal,
    metaPorBu,
    porBu,
    porOrigem,
    metaPorOrigem,
    semDono,
    dias,
    categorias: [...cats.values()].filter((c) => c.valor !== 0 || c.metaValor > 0).sort((a, b) => b.valor - a.valor),
    semTabela,
  };
}

/**
 * Meta por ORIGEM, derivada das metas por linha — ninguem digita.
 *
 * Cada linha de receita tem UMA meta, mas o dinheiro dela chega por origens
 * diferentes (ex.: "Cursos online" vem de vendedor e do site). A meta da linha
 * e repartida entre vendedores / direto / diretoria na MESMA proporcao em que a
 * receita daquela linha chegou por cada origem nos 3 meses anteriores ao periodo.
 *
 * - Usa o historico, e nao o mes corrente, de proposito: se a meta seguisse o
 *   realizado do mes, toda origem estaria sempre "no ritmo" — a meta viraria
 *   espelho do resultado.
 * - Linha sem historico (nova): vai inteira para "vendedores" se conta para
 *   vendedor na Classificacao, senao para "diretoria".
 * - A soma das 3 metas e exatamente a meta total da empresa.
 */
async function distribuirMetaPorOrigem(
  metas: Map<string, { valor: number; bu: string }>,
  de: string,
): Promise<Record<Origem, number>> {
  const out = vazioOrigem();
  const ids = [...metas].filter(([, m]) => m.valor > 0).map(([id]) => id);
  if (!ids.length) return out;

  const [y, m] = de.split("-").map(Number);
  const ini = new Date(y, m - 1 - 3, 1);
  const inicio = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, "0")}-01`;

  const mix = new Map<string, Record<Origem, number>>();
  try {
    const hist = await fetchAll<{ categoria_id: string | null; origem: Origem; valor: number | null }>(
      "gestao(mix-origem)",
      () =>
        supabaseAdmin
          .from("ca_linha_receita")
          .select("categoria_id, origem, valor")
          .gte("sale_date", inicio)
          .lt("sale_date", de)
          .order("ca_venda_id")
          .order("ca_item_id"),
      true,
    );
    for (const h of hist) {
      if (!h.categoria_id) continue;
      const r = mix.get(h.categoria_id) ?? vazioOrigem();
      r[h.origem] += Number(h.valor ?? 0);
      mix.set(h.categoria_id, r);
    }
  } catch {
    /* sem historico: cai na regra da Classificacao */
  }

  const semHist = ids.filter((id) => {
    const r = mix.get(id);
    return !r || r.vendedores + r.direto + r.diretoria <= 0;
  });
  const conta = new Map<string, boolean>();
  if (semHist.length) {
    try {
      const { data } = await supabaseAdmin
        .from("ca_mapa_receita")
        .select("ca_id, conta_vendedor")
        .eq("ca_tipo", "categoria")
        .in("ca_id", semHist);
      for (const r of (data as { ca_id: string; conta_vendedor: boolean | null }[]) ?? []) conta.set(r.ca_id, !!r.conta_vendedor);
    } catch {
      /* sem mapa: diretoria */
    }
  }

  for (const id of ids) {
    const meta = metas.get(id)!.valor;
    const r = mix.get(id);
    const soma = r ? r.vendedores + r.direto + r.diretoria : 0;
    if (r && soma > 0) {
      for (const o of ["vendedores", "direto", "diretoria"] as Origem[]) out[o] += (meta * r[o]) / soma;
    } else {
      out[conta.get(id) ? "vendedores" : "diretoria"] += meta;
    }
  }
  return out;
}

/**
 * Com cache de servidor: o mes corrente recebe venda a cada sync (15 min) e cai
 * junto com o resto do dashboard (`DASHBOARD_TAG`); mes fechado quase nao muda e
 * fica fora da tag, para a venda de hoje nao jogar fora o cache dele.
 */
export function gestaoDoMes(year: number, mes: number | null): Promise<GestaoMes> {
  const hoje = nowRecife();
  const ehCorrente =
    year > hoje.getFullYear() ||
    (year === hoje.getFullYear() && (mes === null || mes >= hoje.getMonth() + 1));
  return unstable_cache(
    () => calcular(year, mes),
    [`gestao-a-vista-v8-${year}-${mes ?? "ano"}`],
    ehCorrente ? { revalidate: 600, tags: [DASHBOARD_TAG] } : { revalidate: 3600 },
  )();
}
