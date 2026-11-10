import * as React from "react";
import { supabaseAdmin } from "./supabase";
import {
  computeSellerStats,
  daysInMonth,
  daysRemainingIncludingToday,
  businessDaysInMonth,
  businessDaysElapsed,
  businessDaysRemainingIncludingToday,
  isBusinessDay,
  nowRecife,
  periodNow,
  todayDayOfMonth,
  type SellerStats,
} from "./calc";
import { productLabel, productIdsFor, buFromProductLine, isQtdPrimary } from "./products";
import { FONTE_PADRAO, type Fonte } from "./fonte";

// ---------------------------------------------------------------------------
// Cache por requisicao + leitura em lote
//
// Antes, cada funcao abaixo fazia as proprias consultas ao Supabase: o painel
// (dashboard TV) disparava ~120 consultas e as telas de Comissoes/Gamificacao
// ~85 a cada abertura (uma rodada de 5 consultas POR vendedor/BU). Agora cada
// conjunto de dados do mes e buscado UMA vez por requisicao (React `cache`,
// deduplicado entre layout, pagina e funcoes) e as agregacoes sao feitas em
// memoria. Fora do React (scripts/testes) `cache` nao existe e vira passthrough.
// ---------------------------------------------------------------------------
const memo: <A extends any[], R>(fn: (...a: A) => R) => (...a: A) => R =
  (React as any).cache || ((fn: any) => fn);

const PAGE = 1000; // limite padrao de linhas por resposta do PostgREST/Supabase

// Le TODAS as linhas de uma consulta paginando com .range(). Sem isso o Supabase
// corta silenciosamente em 1000 linhas (um mes de vendas da empresa passa disso).
export async function fetchAll<T>(label: string, build: () => any, throwOnError = false): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) {
      if (throwOnError) throw new Error(error.message);
      console.error(`fetchAll(${label}) falhou:`, error.message);
      break;
    }
    const rows = ((data as T[]) || []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return {
    firstDay: `${year}-${mm}-01`,
    lastDay: `${next.y}-${String(next.m).padStart(2, "0")}-01`,
  };
}

type BU3 = "cppem" | "unicive" | "colegio_cppem";
type SaleLite = {
  id: string;
  seller_id: string;
  sale_date: string;
  product_line: string;
  valor: number;
  quantidade: number;
  ligacao_status?: string | null;
  indicacao_status?: string | null;
};
const SALE_COLS = "id, seller_id, sale_date, product_line, valor, quantidade, ligacao_status, indicacao_status";

// Todas as vendas do mes (todos os vendedores/BUs), de UMA origem.
//
// `fonte` e um argumento POSICIONAL e primitivo de proposito. `memo` e
// `React.cache`, que chaveia pelos argumentos comparando por identidade: se a
// fonte viesse dentro de um objeto (`{ fonte }`), cada chamada criaria um objeto
// novo, o cache nunca acertaria e voltariamos as ~120 consultas por abertura que
// motivaram esses loaders. E se ela NAO entrasse na assinatura, o dashboard
// normal e o GAV na mesma requisicao serviriam um o cache do outro — o GAV
// mostraria numero manual com cara de Conta Azul, que e o pior resultado
// possivel numa tela cuja funcao e conferir.
const loadMonthSales = memo(
  async (year: number, month: number, fonte: Fonte): Promise<SaleLite[]> => {
    const { firstDay, lastDay } = monthRange(year, month);
    const run = (cols: string, strict: boolean, comOrigem: boolean) =>
      fetchAll<SaleLite>(
        "sales",
        () => {
          const q = supabaseAdmin
            .from("sales")
            .select(cols)
            .gte("sale_date", firstDay)
            .lt("sale_date", lastDay);
          return (comOrigem ? q.eq("origem", fonte) : q).order("id");
        },
        strict
      );
    try {
      return await run(SALE_COLS, true, true);
    } catch (e) {
      const msg = (e as Error).message;
      // Banco sem a coluna `origem` (migracao ca-01-origem.sql pendente).
      // Para `manual` da para degradar: antes da migracao TODA venda e manual,
      // entao ler sem o filtro devolve exatamente o mesmo conjunto e a tela que
      // esta no ar continua correta.
      //
      // Para `conta_azul`, NAO. Degradar ali entregaria as vendas manuais
      // rotuladas como Conta Azul — o GAV diria que esta tudo certo justamente
      // quando nao ha nada para conferir. Melhor devolver vazio: a tela trata e
      // manda rodar a migracao.
      if (/origem/i.test(msg)) {
        if (fonte !== "manual") {
          console.error("sales: coluna `origem` ausente — GAV devolve vazio de proposito.", msg);
          return [];
        }
        console.warn("sales: coluna `origem` ausente — lendo sem filtro (tudo e manual).", msg);
        try {
          return await run(SALE_COLS, true, false);
        } catch {
          return run("*", false, false);
        }
      }
      // Banco sem alguma outra coluna nova: le tudo e degrada.
      console.warn("sales com colunas explicitas falhou — fallback select(*):", msg);
      return run("*", false, true);
    }
  }
);

const loadMonthLeads = memo(async (year: number, month: number) => {
  const { firstDay, lastDay } = monthRange(year, month);
  return fetchAll<{ seller_id: string; date: string; qty: number }>("daily_leads", () =>
    supabaseAdmin
      .from("daily_leads")
      .select("seller_id, date, qty")
      .gte("date", firstDay)
      .lt("date", lastDay)
      .order("id")
  );
});

type ProductGoalRow = { seller_id: string; product_line: string; valor_meta: number; quantidade_meta: number };
type MonthlyGoalRow = {
  seller_id: string;
  bu: BU3;
  ticket_medio_meta: number;
  taxa_conversao_meta: number;
  valor_meta: number;
  quantidade_meta: number;
  leads_meta: number;
};

// Metas do mes: por vendedor/produto, por vendedor/BU, da BU e por categoria da BU.
const loadMonthGoals = memo(async (year: number, month: number) => {
  const [pg, mg, bm, bpg] = await Promise.all([
    supabaseAdmin
      .from("product_goals")
      .select("seller_id, product_line, valor_meta, quantidade_meta")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("monthly_goals")
      .select("seller_id, bu, ticket_medio_meta, taxa_conversao_meta, valor_meta, quantidade_meta, leads_meta")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("bu_meta")
      .select("bu, leads_meta, taxa_conversao_meta")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("bu_product_goals")
      .select("bu, product_line, valor_meta, quantidade_meta")
      .eq("year", year)
      .eq("month", month),
  ]);
  return {
    productGoals: ((pg.data as any[]) || []) as ProductGoalRow[],
    monthlyGoals: ((mg.data as any[]) || []) as MonthlyGoalRow[],
    buMeta: ((bm.data as any[]) || []) as { bu: BU3; leads_meta: number; taxa_conversao_meta: number }[],
    buProductGoals: ((bpg.data as any[]) || []) as { bu: BU3; product_line: string; valor_meta: number; quantidade_meta: number }[],
  };
});

// Canal Direto/IA do mes (vendas e visitas).
const loadMonthDirect = memo(async (year: number, month: number, fonte: Fonte) => {
  const { firstDay, lastDay } = monthRange(year, month);
  const [sales, visits] = await Promise.all([
    // `select("*")` ja tolera coluna nova; o filtro por origem e que exige a
    // migracao. Mesma regra do loadMonthSales: so `manual` degrada sem ela.
    fetchAll<DirectSaleRow>("direct_sales", () =>
      supabaseAdmin
        .from("direct_sales")
        .select("*")
        .eq("origem", fonte)
        .gte("sale_date", firstDay)
        .lt("sale_date", lastDay)
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
    ),
    fetchAll<{ date: string; qty: number }>("direct_visits", () =>
      supabaseAdmin
        .from("direct_visits")
        .select("date, qty")
        .gte("date", firstDay)
        .lt("date", lastDay)
        .order("date")
    ),
  ]);
  return { sales, visits: visits.map((r) => ({ date: r.date, qty: Number(r.qty || 0) })) };
});

export type Seller = {
  id: string;
  name: string;
  bu: "cppem" | "unicive" | "colegio_cppem";          // BU principal (compat)
  bus: ("cppem" | "unicive" | "colegio_cppem")[];      // todas as BUs em que o vendedor atua
  active: boolean;
  avatar_color: string;
  avatar_url?: string | null;
  has_password?: boolean;
};

function sanitizeBus(raw: any, fallbackBu: "cppem" | "unicive" | "colegio_cppem"): ("cppem" | "unicive" | "colegio_cppem")[] {
  const arr = Array.isArray(raw) ? raw : [];
  const clean = arr.filter(
    (x) => x === "cppem" || x === "unicive" || x === "colegio_cppem"
  ) as ("cppem" | "unicive" | "colegio_cppem")[];
  return clean.length > 0 ? Array.from(new Set(clean)) : [fallbackBu];
}

function normalizeSeller(row: any): Seller {
  return {
    id: row.id,
    name: row.name,
    bu: row.bu,
    bus: sanitizeBus(row.bus, row.bu),
    active: row.active,
    avatar_color: row.avatar_color,
    avatar_url: row.avatar_url,
    has_password: Boolean(row.password_hash),
  };
}

export function buListOf(s: Pick<Seller, "bu" | "bus">): ("cppem" | "unicive" | "colegio_cppem")[] {
  return sanitizeBus(s.bus, s.bu);
}

// Colunas que a UI usa. password_hash NAO vai pro cliente — e
// convertido em has_password:bool via normalizeSeller. Mantemos um
// fallback sem password_hash pra o caso do banco ainda nao ter a
// coluna (schema nao rodado), evitando que o sistema inteiro apareca
// vazio de vendedores.
const SELLER_COLS_WITH_PWD =
  "id, name, bu, bus, active, avatar_color, avatar_url, password_hash";
const SELLER_COLS_FALLBACK =
  "id, name, bu, bus, active, avatar_color, avatar_url";

const loadSellers = memo(async (onlyActive: boolean): Promise<Seller[]> => {
  const run = async (cols: string) => {
    let q = supabaseAdmin.from("sellers").select(cols).order("name");
    if (onlyActive) q = q.eq("active", true);
    return q;
  };
  let { data, error } = await run(SELLER_COLS_WITH_PWD);
  if (error) {
    // Provavel: coluna password_hash ainda nao criada no banco. Loga
    // uma vez e tenta de novo sem ela.
    console.warn("listSellers com password_hash falhou — fallback:", error.message);
    ({ data, error } = await run(SELLER_COLS_FALLBACK));
  }
  if (error) {
    console.error("listSellers falhou:", error.message);
    return [];
  }
  return ((data as any[]) || []).map(normalizeSeller);
});

export async function listSellers(opts?: { onlyActive?: boolean }): Promise<Seller[]> {
  return loadSellers(Boolean(opts?.onlyActive));
}

export const getSeller = memo(async (id: string): Promise<Seller | null> => {
  const run = (cols: string) =>
    supabaseAdmin.from("sellers").select(cols).eq("id", id).maybeSingle();
  let { data, error } = await run(SELLER_COLS_WITH_PWD);
  if (error) {
    console.warn("getSeller com password_hash falhou — fallback:", error.message);
    ({ data, error } = await run(SELLER_COLS_FALLBACK));
  }
  if (error) {
    console.error("getSeller falhou:", error.message);
    return null;
  }
  return data ? normalizeSeller(data as any) : null;
});

export async function listSellersOfBu(bu: "cppem" | "unicive" | "colegio_cppem", opts?: { onlyActive?: boolean }): Promise<Seller[]> {
  const all = await listSellers(opts);
  return all.filter((s) => buListOf(s).includes(bu));
}

// =====================================================
// Stats por vendedor — agora SEMPRE atrelado a uma BU.
// Pra vendedor multi-BU, statsForAll devolve 1 entrada por (seller, bu).
// =====================================================
// Dados brutos de UM vendedor no mes (compartilhado entre stats e serie diaria,
// que antes consultavam as mesmas vendas/leads duas vezes). Vendas de TODAS as
// BUs do vendedor numa consulta so: o filtro por BU e a contagem total (usada
// na conversao) saem da mesma lista.
const sellerMonthRaw = memo(async (sellerId: string, year: number, month: number, fonte: Fonte) => {
  const { firstDay, lastDay } = monthRange(year, month);
  const [sales, leads, pg, mg] = await Promise.all([
    fetchAll<SaleLite>("sales(seller)", () =>
      supabaseAdmin
        .from("sales")
        .select("*")
        .eq("seller_id", sellerId)
        .eq("origem", fonte)
        .gte("sale_date", firstDay)
        .lt("sale_date", lastDay)
        .order("id")
    ),
    fetchAll<{ date: string; qty: number }>("daily_leads(seller)", () =>
      supabaseAdmin
        .from("daily_leads")
        .select("date, qty")
        .eq("seller_id", sellerId)
        .gte("date", firstDay)
        .lt("date", lastDay)
        .order("date")
    ),
    supabaseAdmin
      .from("product_goals")
      .select("product_line, valor_meta, quantidade_meta")
      .eq("seller_id", sellerId)
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("monthly_goals")
      .select("bu, ticket_medio_meta, taxa_conversao_meta, valor_meta, quantidade_meta, leads_meta")
      .eq("seller_id", sellerId)
      .eq("year", year)
      .eq("month", month),
  ]);
  return {
    sales,
    leads,
    productGoals: ((pg.data as any[]) || []) as Omit<ProductGoalRow, "seller_id">[],
    monthlyGoals: ((mg.data as any[]) || []) as Omit<MonthlyGoalRow, "seller_id">[],
  };
});

export async function statsForSellerInBu(
  seller: Seller,
  bu: "cppem" | "unicive" | "colegio_cppem",
  opts?: { year?: number; month?: number; fonte?: Fonte }
): Promise<SellerStats> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  const productIds = productIdsFor(bu) as unknown as string[];
  const pidSet = new Set(productIds);
  const raw = await sellerMonthRaw(seller.id, year, month, fonte);

  const leadsMonth = raw.leads.reduce((a, r) => a + Number(r.qty || 0), 0);

  return computeSellerStats({
    seller: {
      id: seller.id,
      name: seller.name,
      bu,
      avatar_url: seller.avatar_url,
      avatar_color: seller.avatar_color,
    },
    productGoals: raw.productGoals.filter((g) => pidSet.has(g.product_line)),
    monthly: raw.monthlyGoals.find((g) => g.bu === bu) || null,
    sales: raw.sales.filter((r) => pidSet.has(r.product_line)),
    // Total de vendas do vendedor em TODAS as BUs no mes (conversao real: leads
    // nao distinguem por BU).
    vendasCountTotal: raw.sales.length,
    leadsMonth,
    year,
    month,
  });
}

// Compat: 1 stats por vendedor — agora retorna array (1+) pra suportar multi-BU.
export async function statsForSeller(
  sellerId: string,
  opts?: { year?: number; month?: number; fonte?: Fonte }
): Promise<SellerStats[]> {
  const seller = await getSeller(sellerId);
  if (!seller) return [];
  const tasks = buListOf(seller).map((bu) => statsForSellerInBu(seller, bu, opts));
  return Promise.all(tasks);
}

export async function statsForAll(opts?: { year?: number; month?: number; fonte?: Fonte }): Promise<SellerStats[]> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  // 5 leituras em lote (vendedores, vendas, leads, metas) no lugar de 5
  // consultas por vendedor/BU.
  const [sellers, sales, leads, goals] = await Promise.all([
    listSellers({ onlyActive: true }),
    loadMonthSales(year, month, fonte),
    loadMonthLeads(year, month),
    loadMonthGoals(year, month),
  ]);

  const salesBySeller = new Map<string, SaleLite[]>();
  for (const r of sales) {
    const arr = salesBySeller.get(r.seller_id);
    if (arr) arr.push(r);
    else salesBySeller.set(r.seller_id, [r]);
  }
  const leadsBySeller = new Map<string, number>();
  for (const r of leads) {
    leadsBySeller.set(r.seller_id, (leadsBySeller.get(r.seller_id) || 0) + Number(r.qty || 0));
  }
  const pgBySeller = new Map<string, ProductGoalRow[]>();
  for (const g of goals.productGoals) {
    const arr = pgBySeller.get(g.seller_id);
    if (arr) arr.push(g);
    else pgBySeller.set(g.seller_id, [g]);
  }
  const mgBySellerBu = new Map<string, MonthlyGoalRow>();
  for (const g of goals.monthlyGoals) mgBySellerBu.set(`${g.seller_id}|${g.bu}`, g);

  const out: SellerStats[] = [];
  for (const seller of sellers) {
    const mine = salesBySeller.get(seller.id) || [];
    const leadsMonth = leadsBySeller.get(seller.id) || 0;
    for (const bu of buListOf(seller)) {
      const pidSet = new Set(productIdsFor(bu) as unknown as string[]);
      out.push(
        computeSellerStats({
          seller: {
            id: seller.id,
            name: seller.name,
            bu,
            avatar_url: seller.avatar_url,
            avatar_color: seller.avatar_color,
          },
          productGoals: (pgBySeller.get(seller.id) || []).filter((g) => pidSet.has(g.product_line)),
          monthly: mgBySellerBu.get(`${seller.id}|${bu}`) || null,
          sales: mine.filter((r) => pidSet.has(r.product_line)),
          vendasCountTotal: mine.length,
          leadsMonth,
          year,
          month,
        })
      );
    }
  }
  return out;
}

// =====================================================
// Series por BU para o dashboard
// =====================================================

export type DailySeriesRow = { day: string; valor: number; qtd: number; leads: number };
export type CumulativeRow = { day: string; pct: number; idealPct: number };

export type BUSeries = {
  daily: DailySeriesRow[];
  cumulative: CumulativeRow[];
  totals: {
    valor: number;
    qtd: number;
    meta: number;
    metaValor: number;     // meta de FATURAMENTO da BU (uteis pra Unicive tambem)
    ticketReal: number;
    ticketMeta: number;
    metaIdealAteHoje: number;
    metaRitmoInicial: number;
    gap: number;
    metaDia: number;
    realizado: number;
    valorHoje: number;
    qtdHoje: number;
    realizadoHoje: number;
    leadsMeta: number;
    taxaConversaoMeta: number;
    // ===== Semana corrente (segunda a domingo) =====
    weekStartDay: number;   // dia do mes em que a semana comeca (dentro do mes)
    weekEndDay: number;     // dia do mes em que a semana termina (dentro do mes)
    weekDaysInMonth: number; // qtd de dias da semana que caem dentro do mes
    weekTarget: number;     // meta ideal de toda a semana (pace * weekDaysInMonth)
    weekReal: number;       // realizado de segunda ate hoje
    weekRemaining: number;  // max(0, weekTarget - weekReal)
    weekActive: boolean;    // se o mes visualizado e o mes atual
    // Metas em FATURAMENTO (utilizadas em Unicive/Colegio onde a meta
    // primaria e qtd, mas o faturamento tambem tem meta e importa)
    metaDiaValor: number;   // meta do dia em R$ (util pra Colegio)
    weekTargetValor: number;
    weekRealValor: number;
    weekRemainingValor: number;
    // Mesmas metricas mas em QUANTIDADE (util pra Unicive mostrar
    // matriculas como secundaria, ja que primaria agora e faturamento)
    metaQtd: number;
    metaDiaQtd: number;
    weekTargetQtd: number;
    weekRealQtd: number;
    weekRemainingQtd: number;
    // Dias uteis do mes (pra o dashboard poder calcular pace/projecao
    // de coisas que nao sao a metrica primaria — leads, por exemplo).
    bDaysTotal: number;
    bDaysElapsed: number;
  };
};

export async function buSeries(
  bu: "cppem" | "unicive" | "colegio_cppem",
  opts?: { year?: number; month?: number; fonte?: Fonte }
): Promise<BUSeries> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const lastDay = `${next.y}-${String(next.m).padStart(2, "0")}-01`;
  const total = daysInMonth(year, month);

  const sellers = await listSellers({ onlyActive: true });
  const buSellers = sellers.filter((s) => buListOf(s).includes(bu));
  const ids = buSellers.map((s) => s.id);
  const productIds = productIdsFor(bu) as unknown as string[];

  if (ids.length === 0) {
    const empty: DailySeriesRow[] = Array.from({ length: total }, (_, i) => ({
      day: String(i + 1).padStart(2, "0") + "/" + String(month).padStart(2, "0"),
      valor: 0,
      qtd: 0,
      leads: 0,
    }));
    return {
      daily: empty,
      cumulative: empty.map((d, i) => ({ day: d.day, pct: 0, idealPct: ((i + 1) / total) * 100 })),
      totals: {
        valor: 0, qtd: 0, meta: 0, metaValor: 0, ticketReal: 0, ticketMeta: 0,
        metaIdealAteHoje: 0, metaRitmoInicial: 0, gap: 0, metaDia: 0,
        realizado: 0, valorHoje: 0, qtdHoje: 0, realizadoHoje: 0,
        leadsMeta: 0, taxaConversaoMeta: 0,
        weekStartDay: 0, weekEndDay: 0, weekDaysInMonth: 0,
        weekTarget: 0, weekReal: 0, weekRemaining: 0, weekActive: false,
        metaDiaValor: 0, weekTargetValor: 0, weekRealValor: 0, weekRemainingValor: 0,
        metaQtd: 0, metaDiaQtd: 0,
        weekTargetQtd: 0, weekRealQtd: 0, weekRemainingQtd: 0,
        bDaysTotal: businessDaysInMonth(year, month),
        bDaysElapsed: businessDaysElapsed(year, month),
      },
    };
  }

  // Leituras do mes em lote (compartilhadas com as demais BUs na mesma requisicao).
  const idSet = new Set(ids);
  const pidSet = new Set(productIds);
  const [allSales, allLeads, goals, direct] = await Promise.all([
    loadMonthSales(year, month, fonte),
    loadMonthLeads(year, month),
    loadMonthGoals(year, month),
    bu === "colegio_cppem" ? Promise.resolve(null) : loadMonthDirect(year, month, fonte),
  ]);
  const sales = allSales.filter((r) => idSet.has(r.seller_id) && pidSet.has(r.product_line));
  const pgoals = goals.productGoals.filter((r) => idSet.has(r.seller_id) && pidSet.has(r.product_line));
  const mgoals = goals.monthlyGoals.filter((r) => idSet.has(r.seller_id) && r.bu === bu);
  const bm = goals.buMeta.find((r) => r.bu === bu) || null;
  const leadsRows = allLeads.filter((r) => idSet.has(r.seller_id));
  const leadsMeta = Number((bm as any)?.leads_meta || 0);
  const taxaConversaoMeta = Number((bm as any)?.taxa_conversao_meta || 0);

  // Meta total: prioridade pra monthly_goals (fluxo novo); fallback pra soma de product_goals
  const mgValor = (mgoals || []).reduce((a: number, b: any) => a + Number(b.valor_meta || 0), 0);
  const mgQtd = (mgoals || []).reduce((a: number, b: any) => a + Number(b.quantidade_meta || 0), 0);
  const pgValor = (pgoals || []).reduce((a: number, b: any) => a + Number(b.valor_meta || 0), 0);
  const pgQtd = (pgoals || []).reduce((a: number, b: any) => a + Number(b.quantidade_meta || 0), 0);
  const metaValor = mgValor > 0 ? mgValor : pgValor;
  const qtdMeta = mgQtd > 0 ? mgQtd : pgQtd;

  const ticketMetaAvg = (mgoals || []).length > 0
    ? (mgoals || []).reduce((a: number, b: any) => a + Number(b.ticket_medio_meta || 0), 0) / (mgoals || []).length
    : 0;

  // Vendas do canal DIRETO (site) e IA (atendimento por IA) tambem
  // contam nas metas coletivas da BU. Elas nao pertencem a nenhum
  // vendedor. O canal 'direto' e so CPPEM; o canal 'ia' pode ser tanto
  // CPPEM quanto UNICIVE. Filtra por product_line pra pegar so as
  // vendas relevantes pra BU atual (Colegio nunca tem venda no direto/IA).
  const directSales = direct ? direct.sales.filter((s) => pidSet.has(s.product_line)) : [];

  const buckets: Record<string, { valor: number; qtd: number; leads: number }> = {};
  for (let d = 1; d <= total; d++) {
    const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    buckets[k] = { valor: 0, qtd: 0, leads: 0 };
  }
  for (const r of (sales as any[]) || []) {
    const k = String(r.sale_date).slice(0, 10);
    if (!buckets[k]) buckets[k] = { valor: 0, qtd: 0, leads: 0 };
    buckets[k].valor += Number(r.valor || 0);
    buckets[k].qtd += Number(r.quantidade || 0);
  }
  for (const r of directSales) {
    const k = String(r.sale_date).slice(0, 10);
    if (!buckets[k]) buckets[k] = { valor: 0, qtd: 0, leads: 0 };
    buckets[k].valor += Number(r.valor || 0);
    buckets[k].qtd += Number(r.quantidade || 0);
  }
  for (const r of (leadsRows as any[]) || []) {
    const k = String(r.date).slice(0, 10);
    if (!buckets[k]) buckets[k] = { valor: 0, qtd: 0, leads: 0 };
    buckets[k].leads += Number(r.qty || 0);
  }

  const isQtd = isQtdPrimary(bu);
  const meta = isQtd ? qtdMeta : metaValor;

  const daily: DailySeriesRow[] = [];
  const cumulative: CumulativeRow[] = [];
  let runValor = 0;
  let runQtd = 0;
  for (let d = 1; d <= total; d++) {
    const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const b = buckets[k];
    runValor += b.valor;
    runQtd += b.qtd;
    const label = `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    daily.push({ day: label, valor: b.valor, qtd: b.qtd, leads: b.leads });
    const real = isQtd ? runQtd : runValor;
    const pct = meta > 0 ? (real / meta) * 100 : 0;
    cumulative.push({ day: label, pct, idealPct: (d / total) * 100 });
  }

  const totalValor = Object.values(buckets).reduce((a, b) => a + b.valor, 0);
  const totalQtd = Object.values(buckets).reduce((a, b) => a + b.qtd, 0);
  const ticketReal = totalQtd > 0 ? totalValor / totalQtd : 0;

  const today = todayDayOfMonth(year, month);
  // Meta do dia baseada em DIAS UTEIS (seg-sex) — nao no total corrido do mes
  const bDaysTotal = businessDaysInMonth(year, month);
  const bDaysElapsed = businessDaysElapsed(year, month);
  const bDaysLeft = businessDaysRemainingIncludingToday(year, month);
  const realizado = isQtd ? totalQtd : totalValor;
  const falta = Math.max(0, meta - realizado);
  const metaRitmoInicial = bDaysTotal > 0 ? meta / bDaysTotal : 0;
  const metaIdealAteHoje = metaRitmoInicial * bDaysElapsed;
  const gap = metaIdealAteHoje - realizado;
  const metaDia = falta > 0 ? falta / bDaysLeft : 0;

  // Metas do dia/semana em FATURAMENTO — usadas em Unicive/Colegio
  // como o segundo eixo de acompanhamento (alem da qtd).
  const faltaValor = Math.max(0, metaValor - totalValor);
  const metaRitmoValor = bDaysTotal > 0 ? metaValor / bDaysTotal : 0;
  const metaDiaValor = faltaValor > 0 ? faltaValor / bDaysLeft : 0;

  // Mesmas metricas mas em QUANTIDADE — pra Unicive mostrar matriculas
  // como card secundario, ja que agora o primario dela e faturamento.
  const faltaQtd = Math.max(0, qtdMeta - totalQtd);
  const metaRitmoQtd = bDaysTotal > 0 ? qtdMeta / bDaysTotal : 0;
  const metaDiaQtd = faltaQtd > 0 ? faltaQtd / bDaysLeft : 0;

  const todayLabel = `${String(today).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
  const hojeBucket = daily.find((d) => d.day === todayLabel) || { valor: 0, qtd: 0 };
  const realizadoHoje = isQtd ? hojeBucket.qtd : hojeBucket.valor;

  // ===== Semana corrente (segunda a domingo, padrao BR) =====
  // Calcula com base na data REAL (Date.now()) — quando o usuario navega
  // pra um mes diferente do atual, marca como inativo.
  const realToday = nowRecife();
  const sameMonth =
    realToday.getFullYear() === year && realToday.getMonth() + 1 === month;
  let weekStartDay = 0;
  let weekEndDay = 0;
  let weekDaysInMonth = 0;
  let weekTarget = 0;
  let weekReal = 0;
  let weekRemaining = 0;
  let weekTargetValor = 0;
  let weekRealValor = 0;
  let weekRemainingValor = 0;
  let weekTargetQtd = 0;
  let weekRealQtd = 0;
  let weekRemainingQtd = 0;
  const weekActive = sameMonth;
  if (sameMonth) {
    const dow = realToday.getDay(); // 0=dom, 1=seg ... 6=sab
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(realToday);
    monday.setDate(realToday.getDate() + offsetToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const firstOfMonth = new Date(year, month - 1, 1);
    const lastOfMonth = new Date(year, month, 0);
    const startD = monday > firstOfMonth ? monday : firstOfMonth;
    const endD = sunday < lastOfMonth ? sunday : lastOfMonth;
    weekStartDay = startD.getDate();
    weekEndDay = endD.getDate();
    // Total de dias no range da semana dentro do mes (pra label)
    weekDaysInMonth = weekEndDay - weekStartDay + 1;
    // Dias UTEIS da semana dentro do mes — usado pra distribuir a meta
    let weekBusinessDays = 0;
    for (let d = weekStartDay; d <= weekEndDay; d++) {
      if (isBusinessDay(year, month, d)) weekBusinessDays++;
    }

    const todayDayNum = realToday.getDate();
    for (let d = weekStartDay; d <= weekEndDay && d <= todayDayNum; d++) {
      const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const b = buckets[k] || { valor: 0, qtd: 0, leads: 0 };
      weekReal += isQtd ? b.qtd : b.valor;
      weekRealValor += b.valor;
      weekRealQtd += b.qtd;
    }
    weekTarget = metaRitmoInicial * weekBusinessDays;
    weekRemaining = Math.max(0, weekTarget - weekReal);
    weekTargetValor = metaRitmoValor * weekBusinessDays;
    weekRemainingValor = Math.max(0, weekTargetValor - weekRealValor);
    weekTargetQtd = metaRitmoQtd * weekBusinessDays;
    weekRemainingQtd = Math.max(0, weekTargetQtd - weekRealQtd);
  }

  return {
    daily,
    cumulative,
    totals: {
      valor: totalValor,
      qtd: totalQtd,
      meta,
      metaValor,
      ticketReal,
      ticketMeta: ticketMetaAvg,
      metaIdealAteHoje,
      metaRitmoInicial,
      gap,
      metaDia,
      realizado,
      valorHoje: hojeBucket.valor,
      qtdHoje: hojeBucket.qtd,
      realizadoHoje,
      leadsMeta,
      taxaConversaoMeta,
      weekStartDay,
      weekEndDay,
      weekDaysInMonth,
      weekTarget,
      weekReal,
      weekRemaining,
      weekActive,
      metaDiaValor,
      weekTargetValor,
      weekRealValor,
      weekRemainingValor,
      metaQtd: qtdMeta,
      metaDiaQtd,
      weekTargetQtd,
      weekRealQtd,
      weekRemainingQtd,
      bDaysTotal,
      bDaysElapsed,
    },
  };
}

// Serie diaria de UM vendedor numa BU (mesmo formato do buSeries, pra reusar o
// UnifiedDailyChart). `meta` = meta do vendedor na metrica primaria da BU
// (stats.metaTotal): o % acumulado e comparado ao ritmo ideal linear do mes.
// Leads nao distinguem BU (daily_leads e por vendedor).
export async function sellerSeries(
  seller: Seller,
  bu: "cppem" | "unicive" | "colegio_cppem",
  meta: number,
  opts?: { year?: number; month?: number; fonte?: Fonte }
): Promise<{ daily: DailySeriesRow[]; cumulative: CumulativeRow[] }> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  const mm = String(month).padStart(2, "0");
  const total = daysInMonth(year, month);
  const productIds = productIdsFor(bu) as unknown as string[];

  const raw = await sellerMonthRaw(seller.id, year, month, fonte);
  const pidSet = new Set(productIds);
  const sales = raw.sales.filter((r) => pidSet.has(r.product_line));
  const leadsRows = raw.leads;

  const buckets: Record<string, { valor: number; qtd: number; leads: number }> = {};
  for (let d = 1; d <= total; d++) {
    buckets[`${year}-${mm}-${String(d).padStart(2, "0")}`] = { valor: 0, qtd: 0, leads: 0 };
  }
  for (const r of (sales as any[]) || []) {
    const b = buckets[String(r.sale_date).slice(0, 10)];
    if (!b) continue;
    b.valor += Number(r.valor || 0);
    b.qtd += Number(r.quantidade || 0);
  }
  for (const r of (leadsRows as any[]) || []) {
    const b = buckets[String(r.date).slice(0, 10)];
    if (b) b.leads += Number(r.qty || 0);
  }

  const isQtd = isQtdPrimary(bu);
  const daily: DailySeriesRow[] = [];
  const cumulative: CumulativeRow[] = [];
  let run = 0;
  for (let d = 1; d <= total; d++) {
    const b = buckets[`${year}-${mm}-${String(d).padStart(2, "0")}`];
    run += isQtd ? b.qtd : b.valor;
    const label = `${String(d).padStart(2, "0")}/${mm}`;
    daily.push({ day: label, valor: b.valor, qtd: b.qtd, leads: b.leads });
    cumulative.push({ day: label, pct: meta > 0 ? (run / meta) * 100 : 0, idealPct: (d / total) * 100 });
  }
  return { daily, cumulative };
}

// =====================================================
// Breakdown por linha de produto (mantem fluxo de bu_product_goals)
// =====================================================
export type ProductBreakdownRow = {
  product_line: string;
  label: string;
  valor: number;
  qtd: number;
  valor_meta: number;
  quantidade_meta: number;
};

export async function productBreakdown(
  bu: "cppem" | "unicive" | "colegio_cppem",
  opts?: { year?: number; month?: number; fonte?: Fonte }
): Promise<ProductBreakdownRow[]> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;

  const sellers = await listSellers({ onlyActive: true });
  const buSellers = sellers.filter((s) => buListOf(s).includes(bu));
  const ids = buSellers.map((s) => s.id);
  const idSet = new Set(ids);
  const productIds = productIdsFor(bu) as unknown as string[];
  const pidSet = new Set(productIds);

  const map: Record<string, ProductBreakdownRow> = {};
  productIds.forEach((id) => {
    map[id] = {
      product_line: id,
      label: productLabel(id),
      valor: 0,
      qtd: 0,
      valor_meta: 0,
      quantidade_meta: 0,
    };
  });

  const withDirect = bu === "cppem" || bu === "unicive";
  const [allSales, goals, direct] = await Promise.all([
    ids.length === 0 ? Promise.resolve([] as SaleLite[]) : loadMonthSales(year, month, fonte),
    loadMonthGoals(year, month),
    withDirect ? loadMonthDirect(year, month, fonte) : Promise.resolve(null),
  ]);
  const sales = allSales.filter((r) => idSet.has(r.seller_id) && pidSet.has(r.product_line));
  const buGoals = goals.buProductGoals.filter((g) => g.bu === bu);
  const legacyGoals =
    ids.length === 0
      ? []
      : goals.productGoals.filter((g) => idSet.has(g.seller_id) && pidSet.has(g.product_line));

  for (const s of (sales as any[]) || []) {
    if (map[s.product_line]) {
      map[s.product_line].valor += Number(s.valor || 0);
      map[s.product_line].qtd += Number(s.quantidade || 0);
    }
  }

  // Vendas do canal DIRETO/IA tambem contam nas metas por categoria da
  // BU. Direto e so CPPEM; IA pode ser CPPEM ou UNICIVE. Filtra por
  // product_line (`map`) pra pegar so as relevantes da BU atual.
  if (direct) {
    for (const r of direct.sales) {
      if (map[r.product_line]) {
        map[r.product_line].valor += Number(r.valor || 0);
        map[r.product_line].qtd += Number(r.quantidade || 0);
      }
    }
  }

  const hasBuGoals = buGoals.length > 0;
  if (hasBuGoals) {
    for (const g of buGoals) {
      if (map[g.product_line]) {
        map[g.product_line].valor_meta = Number(g.valor_meta || 0);
        map[g.product_line].quantidade_meta = Number(g.quantidade_meta || 0);
      }
    }
  } else {
    for (const g of legacyGoals) {
      if (map[g.product_line]) {
        map[g.product_line].valor_meta += Number(g.valor_meta || 0);
        map[g.product_line].quantidade_meta += Number(g.quantidade_meta || 0);
      }
    }
  }
  return Object.values(map);
}

// =====================================================
// Ligacoes Onvox
// =====================================================
export type LigacaoRow = { status: string; count: number; valor: number };
export type IndicacaoRow = { status: string; count: number; valor: number };

export async function indicacaoBreakdown(opts?: {
  bu?: "cppem" | "unicive" | "colegio_cppem";
  year?: number;
  month?: number;
  fonte?: Fonte;
}): Promise<IndicacaoRow[]> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  let data = await loadMonthSales(year, month, fonte);
  if (opts?.bu) {
    const pidSet = new Set(productIdsFor(opts.bu) as unknown as string[]);
    data = data.filter((r) => pidSet.has(r.product_line));
  }
  const acc: Record<string, IndicacaoRow> = {
    feita_por_indicacao: { status: "feita_por_indicacao", count: 0, valor: 0 },
    sem_indicacao: { status: "sem_indicacao", count: 0, valor: 0 },
  };
  for (const r of data) {
    const k = r.indicacao_status || "sem_indicacao";
    if (!acc[k]) acc[k] = { status: k, count: 0, valor: 0 };
    acc[k].count += 1;
    acc[k].valor += Number(r.valor || 0);
  }
  return Object.values(acc);
}

export async function ligacaoBreakdown(opts?: {
  bu?: "cppem" | "unicive" | "colegio_cppem";
  year?: number;
  month?: number;
  fonte?: Fonte;
}): Promise<LigacaoRow[]> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  let data = await loadMonthSales(year, month, fonte);
  if (opts?.bu) {
    const pidSet = new Set(productIdsFor(opts.bu) as unknown as string[]);
    data = data.filter((r) => pidSet.has(r.product_line));
  }
  const acc: Record<string, LigacaoRow> = {
    consegui_direto: { status: "consegui_direto", count: 0, valor: 0 },
    consegui_indireto: { status: "consegui_indireto", count: 0, valor: 0 },
    sem_ligacao: { status: "sem_ligacao", count: 0, valor: 0 },
  };
  for (const r of data) {
    const k = r.ligacao_status || "sem_ligacao";
    if (!acc[k]) acc[k] = { status: k, count: 0, valor: 0 };
    acc[k].count += 1;
    acc[k].valor += Number(r.valor || 0);
  }
  return Object.values(acc);
}

// =====================================================
// Snapshot do dashboard
// =====================================================
// =====================================================
// Canal DIRETO (site/direct response) — vendas do CPPEM sem vendedor
// =====================================================
export type DirectSaleRow = {
  id: string;
  sale_date: string;
  product_line: string;
  valor: number;
  quantidade: number;
  observacao?: string | null;
  channel?: "direto" | "ia" | null;
};

// Vendas/visitas do canal Direto/IA do mes (compartilhado, ver loadMonthDirect).
// `fonte` com default: os chamadores antigos (aba Direto/IA) seguem lendo o
// manual sem alteracao.
export async function directMonthRaw(year: number, month: number, fonte: Fonte = FONTE_PADRAO) {
  return loadMonthDirect(year, month, fonte);
}

async function fetchDirectSales(year: number, month: number, fonte: Fonte): Promise<DirectSaleRow[]> {
  return (await loadMonthDirect(year, month, fonte)).sales;
}

async function fetchDirectVisits(
  year: number,
  month: number,
  fonte: Fonte
): Promise<{ date: string; qty: number }[]> {
  return (await loadMonthDirect(year, month, fonte)).visits;
}

export type DirectSnapshot = {
  year: number;
  month: number;
  daily: { day: string; valor: number; qtd: number; visits: number }[];
  totals: {
    valor: number;      // faturamento acumulado (direto + IA)
    qtd: number;        // qtd de vendas somadas
    vendasCount: number;// numero de linhas de venda
    ticketReal: number; // valor / qtd
    visits: number;     // visitas totais no mes (canal direto/site)
    visitsHoje: number; // visitas do dia atual
    valorHoje: number;  // faturamento do dia atual
    qtdHoje: number;    // qtd vendida hoje
    conversao: number;  // qtd vendida (unidades) / visitas * 100 (canal direto)
    // Split por canal:
    valorDireto: number;
    valorIA: number;
    qtdDireto: number;
    qtdIA: number;
    // Split por BU (so tem IA em UNICIVE hoje):
    valorCppem: number;
    valorUnicive: number;
    qtdCppem: number;
    qtdUnicive: number;
  };
  breakdown: ProductBreakdownRow[];         // por linha de produto CPPEM (direto + IA CPPEM)
  breakdownUnicive: ProductBreakdownRow[];  // por linha de produto UNICIVE (so IA)
  // Mesmos numeros, separados por canal (Site/direto x IA). Campo novo: nada acima mudou.
  channels: { direto: DirectChannelAgg; ia: DirectChannelAgg };
};

export type DirectChannelAgg = {
  valor: number;
  qtd: number;
  vendasCount: number;
  valorCppem: number;
  qtdCppem: number;
  valorUnicive: number;
  qtdUnicive: number;
  breakdown: ProductBreakdownRow[];
  breakdownUnicive: ProductBreakdownRow[];
};

export async function directSnapshot(opts?: {
  year?: number;
  month?: number;
  fonte?: Fonte;
}): Promise<DirectSnapshot> {
  const { year, month } = { ...periodNow(), ...opts };
  const fonte: Fonte = opts?.fonte ?? FONTE_PADRAO;
  const total = daysInMonth(year, month);

  const [sales, visits] = await Promise.all([
    fetchDirectSales(year, month, fonte),
    fetchDirectVisits(year, month, fonte),
  ]);

  const buckets: Record<string, { valor: number; qtd: number; visits: number }> = {};
  for (let d = 1; d <= total; d++) {
    const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    buckets[k] = { valor: 0, qtd: 0, visits: 0 };
  }
  for (const r of sales) {
    const k = String(r.sale_date).slice(0, 10);
    if (!buckets[k]) buckets[k] = { valor: 0, qtd: 0, visits: 0 };
    buckets[k].valor += Number(r.valor || 0);
    buckets[k].qtd += Number(r.quantidade || 0);
  }
  for (const v of visits) {
    const k = String(v.date).slice(0, 10);
    if (!buckets[k]) buckets[k] = { valor: 0, qtd: 0, visits: 0 };
    buckets[k].visits += Number(v.qty || 0);
  }

  const daily = [];
  for (let d = 1; d <= total; d++) {
    const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const b = buckets[k];
    daily.push({
      day: `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
      valor: b.valor,
      qtd: b.qtd,
      visits: b.visits,
    });
  }

  const totalValor = Object.values(buckets).reduce((a, b) => a + b.valor, 0);
  const totalQtd = Object.values(buckets).reduce((a, b) => a + b.qtd, 0);
  const totalVisits = Object.values(buckets).reduce((a, b) => a + b.visits, 0);
  const ticketReal = totalQtd > 0 ? totalValor / totalQtd : 0;
  const conversao = totalVisits > 0 ? (totalQtd / totalVisits) * 100 : 0;

  const nowR = nowRecife();
  const today = todayDayOfMonth(year, month);
  const todayKey = `${year}-${String(month).padStart(2, "0")}-${String(today).padStart(2, "0")}`;
  const hoje = buckets[todayKey] || { valor: 0, qtd: 0, visits: 0 };
  const isCurrent = nowR.getFullYear() === year && nowR.getMonth() + 1 === month;

  // Breakdown por linha de produto CPPEM (direto + IA cppem)
  const cppemIds = productIdsFor("cppem") as unknown as string[];
  const unciveIds = productIdsFor("unicive") as unknown as string[];
  const cppemSet = new Set(cppemIds);
  const uniciveSet = new Set(unciveIds);
  const map: Record<string, ProductBreakdownRow> = {};
  for (const id of cppemIds) {
    map[id] = { product_line: id, label: productLabel(id), valor: 0, qtd: 0, valor_meta: 0, quantidade_meta: 0 };
  }
  const mapUni: Record<string, ProductBreakdownRow> = {};
  for (const id of unciveIds) {
    mapUni[id] = { product_line: id, label: productLabel(id), valor: 0, qtd: 0, valor_meta: 0, quantidade_meta: 0 };
  }

  let valorDireto = 0, valorIA = 0, qtdDireto = 0, qtdIA = 0;
  let valorCppem = 0, valorUnicive = 0, qtdCppem = 0, qtdUnicive = 0;

  for (const r of sales) {
    const v = Number(r.valor || 0);
    const q = Number(r.quantidade || 0);
    if (r.channel === "ia") { valorIA += v; qtdIA += q; }
    else { valorDireto += v; qtdDireto += q; }
    if (cppemSet.has(r.product_line)) {
      valorCppem += v; qtdCppem += q;
      if (map[r.product_line]) {
        map[r.product_line].valor += v;
        map[r.product_line].qtd += q;
      }
    } else if (uniciveSet.has(r.product_line)) {
      valorUnicive += v; qtdUnicive += q;
      if (mapUni[r.product_line]) {
        mapUni[r.product_line].valor += v;
        mapUni[r.product_line].qtd += q;
      }
    }
  }
  const breakdown = Object.values(map);
  const breakdownUnicive = Object.values(mapUni);

  // Mesmas vendas, agrupadas por canal (IA = channel "ia"; o resto e Site/direto,
  // igual a regra usada nos totais acima).
  const aggregateChannel = (wantIA: boolean): DirectChannelAgg => {
    const m: Record<string, ProductBreakdownRow> = {};
    for (const id of cppemIds) {
      m[id] = { product_line: id, label: productLabel(id), valor: 0, qtd: 0, valor_meta: 0, quantidade_meta: 0 };
    }
    const mu: Record<string, ProductBreakdownRow> = {};
    for (const id of unciveIds) {
      mu[id] = { product_line: id, label: productLabel(id), valor: 0, qtd: 0, valor_meta: 0, quantidade_meta: 0 };
    }
    const a = { valor: 0, qtd: 0, vendasCount: 0, valorCppem: 0, qtdCppem: 0, valorUnicive: 0, qtdUnicive: 0 };
    for (const r of sales) {
      if ((r.channel === "ia") !== wantIA) continue;
      const v = Number(r.valor || 0);
      const q = Number(r.quantidade || 0);
      a.valor += v; a.qtd += q; a.vendasCount += 1;
      if (cppemSet.has(r.product_line)) {
        a.valorCppem += v; a.qtdCppem += q;
        if (m[r.product_line]) { m[r.product_line].valor += v; m[r.product_line].qtd += q; }
      } else if (uniciveSet.has(r.product_line)) {
        a.valorUnicive += v; a.qtdUnicive += q;
        if (mu[r.product_line]) { mu[r.product_line].valor += v; mu[r.product_line].qtd += q; }
      }
    }
    return { ...a, breakdown: Object.values(m), breakdownUnicive: Object.values(mu) };
  };

  return {
    year,
    month,
    daily,
    totals: {
      valor: totalValor,
      qtd: totalQtd,
      vendasCount: sales.length,
      ticketReal,
      visits: totalVisits,
      visitsHoje: isCurrent ? hoje.visits : 0,
      valorHoje: isCurrent ? hoje.valor : 0,
      qtdHoje: isCurrent ? hoje.qtd : 0,
      conversao,
      valorDireto, valorIA, qtdDireto, qtdIA,
      valorCppem, valorUnicive, qtdCppem, qtdUnicive,
    },
    breakdown,
    breakdownUnicive,
    channels: { direto: aggregateChannel(false), ia: aggregateChannel(true) },
  };
}

export type DashboardSnapshot = {
  bu: "cppem" | "unicive" | "colegio_cppem";
  series: BUSeries;
  sellers: SellerStats[];
  taxaConversao: number;
  leadsTotal: number;
  breakdown: ProductBreakdownRow[];
  ligacao: LigacaoRow[];
  indicacao: IndicacaoRow[];
  longTerm: import("./longTerm").LongTermProgress | null;
};

export async function dashboardSnapshot(
  bu: "cppem" | "unicive" | "colegio_cppem",
  opts?: { year?: number; month?: number; fonte?: Fonte },
  // Stats de todos os vendedores ja carregados por quem chama — evita refazer
  // as mesmas consultas uma vez por BU.
  allStats?: SellerStats[]
): Promise<DashboardSnapshot> {
  const { loadLongTermGoal, computeLongTermProgress } = await import("./longTerm");
  const [series, all, breakdown, ligacao, indicacao, ltGoal] = await Promise.all([
    buSeries(bu, opts),
    allStats ?? statsForAll(opts),
    productBreakdown(bu, opts),
    ligacaoBreakdown({ bu, ...opts }),
    indicacaoBreakdown({ bu, ...opts }),
    // A meta longa NAO tem origem: ela conta matriculas da base, nao vendas do
    // mes. Fica igual nas duas visoes, de proposito.
    loadLongTermGoal(bu),
  ]);
  const longTerm = ltGoal ? await computeLongTermProgress(ltGoal) : null;
  const sellers = all.filter((s) => s.bu === bu);
  // Leads sao por vendedor (sem distincao de BU). Pra evitar dupla contagem
  // em vendedor multi-BU, dedup por sellerId.
  const leadsBySeller = new Map<string, number>();
  for (const s of sellers) {
    if (!leadsBySeller.has(s.sellerId)) leadsBySeller.set(s.sellerId, s.leads);
  }
  const leadsTotal = Array.from(leadsBySeller.values()).reduce((a, b) => a + b, 0);
  const vendas = sellers.reduce((a, b) => a + b.vendasCount, 0);
  const taxaConversao = leadsTotal > 0 ? (vendas / leadsTotal) * 100 : 0;
  return { bu, series, sellers, leadsTotal, taxaConversao, breakdown, ligacao, indicacao, longTerm };
}

export { daysInMonth, daysRemainingIncludingToday, todayDayOfMonth, periodNow };
