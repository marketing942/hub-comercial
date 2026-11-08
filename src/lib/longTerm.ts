import { supabaseAdmin } from "./supabase";
import { COLEGIO_MATRICULAS_IDS, type BU } from "./products";
import { isBusinessDay, nowRecife } from "./calc";
import { buListOf, fetchAll, listSellers } from "./data";

export type LongTermGoal = {
  id: string;
  bu: BU;
  label: string;
  base_count: number;
  target: number;
  start_year: number;
  start_month: number;
  end_year: number;
  end_month: number;
  active: boolean;
};

// Ids de produtos que contam pro realizado da meta longa (por BU).
// Hoje so o Colegio tem meta longa, mas ja deixamos generico.
function relevantProductIds(bu: BU): string[] {
  if (bu === "colegio_cppem") return COLEGIO_MATRICULAS_IDS as unknown as string[];
  if (bu === "unicive") return ["matriculas"];
  return [];
}

export async function loadLongTermGoal(bu: BU): Promise<LongTermGoal | null> {
  const { data } = await supabaseAdmin
    .from("long_term_goals")
    .select("id, bu, label, base_count, target, start_year, start_month, end_year, end_month, active")
    .eq("bu", bu)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any) || null;
}

export async function listLongTermGoals(bu?: BU): Promise<LongTermGoal[]> {
  let q = supabaseAdmin
    .from("long_term_goals")
    .select("id, bu, label, base_count, target, start_year, start_month, end_year, end_month, active")
    .order("bu")
    .order("created_at", { ascending: false });
  if (bu) q = q.eq("bu", bu);
  const { data } = await q;
  return ((data as any[]) || []);
}

export type LongTermProgress = {
  goal: LongTermGoal;
  baseCount: number;         // alunos ja matriculados antes do inicio
  novasNoPeriodo: number;    // matriculas registradas de start ate hoje
  realizado: number;         // base + novas
  meta: number;              // target
  restam: number;            // max(0, meta - realizado)
  pctMeta: number;           // realizado / meta * 100
  // ==== Ritmo ao longo do periodo (usa dias uteis) ====
  bDaysTotal: number;        // dias uteis do periodo inteiro
  bDaysElapsed: number;      // dias uteis ja passados desde o inicio
  bDaysLeft: number;         // dias uteis restantes ate o fim
  // Esperado de NOVAS matriculas ate agora (nao inclui a base)
  expectedNovasAteHoje: number;
  // Pace = novas reais - esperado. Positivo = acima do ritmo.
  paceNovas: number;
  paceIsAhead: boolean;
  hasMeta: boolean;
  // Projecao final se seguir nesse ritmo (base + extrapolacao das novas)
  projecaoNovas: number;
  projecaoTotal: number;
  pctProjecao: number;
  // Estado do periodo em relacao a hoje
  periodStarted: boolean;    // se hoje ja passou do inicio
  periodEnded: boolean;      // se hoje ja passou do fim
};

// Conta dias uteis (seg-sex, sem feriados nacionais) entre duas datas
// inclusive, usando isBusinessDay do calc pra bater com o resto do sistema.
function businessDaysBetweenExact(
  startY: number, startM: number, startD: number,
  endY: number, endM: number, endD: number
): number {
  const startTs = Date.UTC(startY, startM - 1, startD);
  const endTs = Date.UTC(endY, endM - 1, endD);
  if (endTs < startTs) return 0;
  let total = 0;
  let y = startY, m = startM, d = startD;
  while (true) {
    if (isBusinessDay(y, m, d)) total++;
    if (y === endY && m === endM && d === endD) break;
    // Proximo dia
    const daysThisMonth = new Date(y, m, 0).getDate();
    if (d < daysThisMonth) {
      d++;
    } else {
      d = 1;
      if (m === 12) { m = 1; y++; } else { m++; }
    }
  }
  return total;
}

export async function computeLongTermProgress(
  goal: LongTermGoal
): Promise<LongTermProgress> {
  // Datas: primeiro dia do start_month ate ultimo dia do end_month
  const firstDay = `${goal.start_year}-${String(goal.start_month).padStart(2, "0")}-01`;
  const endNext =
    goal.end_month === 12
      ? { y: goal.end_year + 1, m: 1 }
      : { y: goal.end_year, m: goal.end_month + 1 };
  const dayAfterLast = `${endNext.y}-${String(endNext.m).padStart(2, "0")}-01`;

  // Vendedores da BU (pra filtrar sales). Lista compartilhada na requisicao.
  const sellerIds = (await listSellers({ onlyActive: true }))
    .filter((s) => buListOf(s).includes(goal.bu))
    .map((s) => s.id);

  const productIds = relevantProductIds(goal.bu);

  // Hoje em Recife
  const nowR = nowRecife();
  const todayY = nowR.getFullYear();
  const todayM = nowR.getMonth() + 1;
  const todayD = nowR.getDate();
  const todayISO = `${todayY}-${String(todayM).padStart(2, "0")}-${String(todayD).padStart(2, "0")}`;

  // Recorte real do range para consulta: min(hoje, ultimo dia do fim) e nao
  // ir alem do fim do periodo.
  const upperCutoffISO = todayISO < dayAfterLast ? todayISO : dayAfterLast;
  const periodStarted = todayISO >= firstDay;
  const periodEnded = todayISO >= dayAfterLast;

  let novasNoPeriodo = 0;
  if (sellerIds.length > 0 && productIds.length > 0 && periodStarted) {
    // upperCutoffISO e exclusivo (< upperCutoffISO), entao pra pegar ATE
    // hoje precisamos usar hoje + 1 dia. Mas mais simples: passamos
    // upperCutoffISO como lt, e antes disso incrementamos por 1 dia
    // se for a data de hoje.
    // Pra manter simples: usa <= todayISO em vez de < dayAfter.
    const upperLteISO =
      todayISO < dayAfterLast ? todayISO : lastDayOfMonth(goal.end_year, goal.end_month);
    // Periodo longo (varios meses): pagina pra nao cortar em 1000 linhas.
    const salesRows = await fetchAll<{ quantidade: number }>("sales(long-term)", () =>
      supabaseAdmin
        .from("sales")
        .select("quantidade")
        .in("seller_id", sellerIds)
        .in("product_line", productIds)
        .gte("sale_date", firstDay)
        .lte("sale_date", upperLteISO)
        .order("id")
    );
    novasNoPeriodo = salesRows.reduce(
      (sum, r) => sum + Number(r.quantidade || 0),
      0
    );
  }

  const realizado = goal.base_count + novasNoPeriodo;
  const meta = goal.target;
  const restam = Math.max(0, meta - realizado);
  const pctMeta = meta > 0 ? (realizado / meta) * 100 : 0;

  // Dias uteis do periodo total
  const lastY = goal.end_year;
  const lastM = goal.end_month;
  const lastD = new Date(lastY, lastM, 0).getDate();
  const bDaysTotal = businessDaysBetweenExact(
    goal.start_year, goal.start_month, 1,
    lastY, lastM, lastD
  );

  // Elapsed: do inicio ate min(hoje, ultimo dia). Se hoje antes do inicio, 0.
  let bDaysElapsed = 0;
  if (periodStarted) {
    const cutY = periodEnded ? lastY : todayY;
    const cutM = periodEnded ? lastM : todayM;
    const cutD = periodEnded ? lastD : todayD;
    bDaysElapsed = businessDaysBetweenExact(
      goal.start_year, goal.start_month, 1,
      cutY, cutM, cutD
    );
  }
  const bDaysLeft = Math.max(0, bDaysTotal - bDaysElapsed);

  // Meta de NOVAS matriculas (nao inclui base)
  const novasMeta = Math.max(0, meta - goal.base_count);
  const expectedNovasAteHoje =
    bDaysTotal > 0 ? novasMeta * (bDaysElapsed / bDaysTotal) : 0;
  const paceNovas = novasNoPeriodo - expectedNovasAteHoje;
  const hasMeta = meta > 0 && bDaysTotal > 0 && novasMeta > 0;
  const paceIsAhead = hasMeta && paceNovas >= 0;

  const projecaoNovas =
    bDaysElapsed > 0 ? novasNoPeriodo * (bDaysTotal / bDaysElapsed) : 0;
  const projecaoTotal = goal.base_count + projecaoNovas;
  const pctProjecao = meta > 0 ? (projecaoTotal / meta) * 100 : 0;

  return {
    goal,
    baseCount: goal.base_count,
    novasNoPeriodo,
    realizado,
    meta,
    restam,
    pctMeta,
    bDaysTotal,
    bDaysElapsed,
    bDaysLeft,
    expectedNovasAteHoje,
    paceNovas,
    paceIsAhead,
    hasMeta,
    projecaoNovas,
    projecaoTotal,
    pctProjecao,
    periodStarted,
    periodEnded,
  };
}

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
