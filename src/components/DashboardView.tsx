import type { DashboardSnapshot } from "@/lib/data";
import { BRL, fmtInt, fmtPct, paceProjection } from "@/lib/calc";
import { BU_COLOR, BU_LABEL, COLOR, tonePctMeta } from "@/lib/brand";
import { isQtdPrimary } from "@/lib/products";
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChart";
import ProductRevenueBreakdown from "@/components/ProductRevenueBreakdown";
import ColegioTurmasBreakdown from "@/components/ColegioTurmasBreakdown";
import UniciveCategoriasBreakdown from "@/components/UniciveCategoriasBreakdown";
import LongTermGoalCard from "@/components/LongTermGoalCard";
import ProgressBar from "@/components/ProgressBar";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function DashboardView({
  snap,
  day,
  totalDays,
  daysLeft,
  monthName,
}: {
  snap: DashboardSnapshot;
  day: number;
  totalDays: number;
  daysLeft: number;
  monthName: string;
}) {
  const { bu, series, sellers, leadsTotal, taxaConversao, breakdown } = snap;
  const isQtd = isQtdPrimary(bu);
  const color = BU_COLOR[bu];
  const t = series.totals;

  const realizado = t.realizado;
  const pct = t.meta > 0 ? (realizado / t.meta) * 100 : 0;
  const falta = Math.max(0, t.meta - realizado);
  const fmtMeta = (n: number) => (isQtd ? fmtInt.format(Math.round(n)) : BRL.format(n));
  const pctTone = tonePctMeta(pct, t.gap);

  // Faturamento (Unicive / Colegio importam tambem)
  const pctFat = t.metaValor > 0 ? (t.valor / t.metaValor) * 100 : 0;
  const faltaFat = Math.max(0, t.metaValor - t.valor);
  const pctFatTone = tonePctMeta(pctFat, 0);

  // Meta do dia
  const metaDia = t.metaDia;
  const realHoje = t.realizadoHoje;
  const faltaHoje = Math.max(0, metaDia - realHoje);
  const diff = realHoje - metaDia;
  const vencendo = realHoje >= metaDia && metaDia > 0;
  const empate = Math.abs(diff) < (isQtd ? 0.5 : 0.01);
  const semMeta = metaDia <= 0 || t.meta === 0;
  const placarColor = semMeta
    ? COLOR.mute
    : empate
    ? COLOR.warning
    : vencendo
    ? COLOR.ok
    : COLOR.danger;
  const placarLabel = semMeta
    ? "Sem meta definida"
    : pct >= 100
    ? "Meta do mes batida"
    : empate
    ? "No ritmo do dia"
    : vencendo
    ? "Vencendo o dia"
    : "Atras no dia";

  const totalVendas = sellers.reduce((a, b) => a + b.vendasCount, 0);
  const leadsMeta = t.leadsMeta;
  const leadsPct = leadsMeta > 0 ? (leadsTotal / leadsMeta) * 100 : 0;
  const leadsTone = leadsMeta > 0 ? (leadsTotal >= leadsMeta ? COLOR.ok : COLOR.danger) : COLOR.neutral;

  // ==== Pace + Projecao ====
  // Total Vendido usa a metrica primaria da BU (R$ pra CPPEM/UNI, qtd pra Colegio)
  const paceRealizado = paceProjection(realizado, t.meta, t.bDaysElapsed, t.bDaysTotal);
  // Faturamento (importante em Unicive/Colegio como card separado)
  const paceValor = paceProjection(t.valor, t.metaValor, t.bDaysElapsed, t.bDaysTotal);
  // Matriculas (qtd) — usado na linha extra da Unicive
  const paceQtd = paceProjection(t.qtd, t.metaQtd, t.bDaysElapsed, t.bDaysTotal);
  // Leads
  const paceLeads = paceProjection(leadsTotal, leadsMeta, t.bDaysElapsed, t.bDaysTotal);

  // Cores semanticas para Ticket e Conversao (X real / Y meta)
  const ticketTone =
    t.ticketMeta > 0
      ? t.ticketReal >= t.ticketMeta
        ? COLOR.ok
        : COLOR.danger
      : COLOR.neutral;
  const convMetaBU = t.taxaConversaoMeta;
  const convTone =
    convMetaBU > 0
      ? taxaConversao >= convMetaBU
        ? COLOR.ok
        : COLOR.danger
      : COLOR.neutral;

  // ---- Meta do dia / da semana: dados prontos por variante ----
  const dayMain = {
    label: isQtd ? "Meta do dia (matriculas)" : "Meta do dia",
    meta: fmtMeta(metaDia),
    hoje: fmtMeta(realHoje),
    falta: fmtMeta(faltaHoje),
    ok: vencendo || empate || semMeta,
    zero: isQtd ? "0" : "R$ 0,00",
  };
  const weekMain = {
    label: isQtd ? "Meta da semana (matriculas)" : "Meta da semana",
    active: t.weekActive, target: t.weekTarget, real: t.weekReal, remaining: t.weekRemaining,
    fmt: fmtMeta, zero: isQtd ? "0" : "R$ 0,00",
  };

  const ritmo = (
    <>
      {isQtd && (
        <Cell label="Faturamento" value={BRL.format(t.valor)} tone={COLOR.neutral}>
          <div className="mt-1"><ProgressBar value={pctFat} color={pctFatTone} height={6} /></div>
          <div className="mt-1.5">
            Meta <b className="text-white/70">{BRL.format(t.metaValor)}</b>
            <span className="mx-1.5 text-white/25">·</span>
            <b style={{ color: pctFatTone }}>{fmtPct(pctFat)}</b>
          </div>
          <div className="mt-0.5">
            {pctFat >= 100 ? (
              <b style={{ color: COLOR.ok }}>Meta batida</b>
            ) : (
              <>Faltam <b style={{ color: pctFatTone }}>{BRL.format(faltaFat)}</b></>
            )}
          </div>
          <PaceProjInfo
            paceDelta={paceValor.paceDelta}
            paceIsAhead={paceValor.paceIsAhead}
            hasMeta={paceValor.hasMeta}
            projecao={paceValor.projecao}
            pctProjecao={paceValor.pctProjecao}
            fmt={(n) => BRL.format(n)}
          />
        </Cell>
      )}
      <DayCell {...dayMain} />
      {isQtd && (
        <DayCell
          label="Meta do dia (faturamento)"
          meta={BRL.format(t.metaDiaValor)}
          hoje={BRL.format(t.valorHoje)}
          falta={BRL.format(Math.max(0, t.metaDiaValor - t.valorHoje))}
          ok={(t.valorHoje >= t.metaDiaValor && t.metaDiaValor > 0) || Math.abs(t.valorHoje - t.metaDiaValor) < 0.01 || t.metaValor === 0 || t.metaDiaValor <= 0}
          zero="R$ 0,00"
        />
      )}
      <WeekCell {...weekMain} />
      {isQtd && (
        <WeekCell
          label="Meta da semana (faturamento)"
          active={t.weekActive}
          target={t.weekTargetValor}
          real={t.weekRealValor}
          remaining={t.weekRemainingValor}
          fmt={(n: number) => BRL.format(n)}
          zero="R$ 0,00"
        />
      )}
      <Cell label="Ticket medio" value={BRL.format(t.ticketReal)} tone={ticketTone}>
        {t.ticketMeta > 0 ? <>Meta {BRL.format(t.ticketMeta)}</> : "Sem meta"}
      </Cell>
      <Cell label="Conversao" value={fmtPct(taxaConversao)} tone={convTone}>
        {convMetaBU > 0 ? <>Meta {fmtPct(convMetaBU)}</> : "Sem meta"}
      </Cell>
      <Cell label="Leads no mes" value={fmtInt.format(leadsTotal)} tone={leadsTone}>
        {leadsMeta > 0 ? <>Meta {fmtInt.format(leadsMeta)} <b className="text-white/70">{fmtPct(leadsPct)}</b></> : "Sem meta"}
        <PaceProjInfo
          paceDelta={paceLeads.paceDelta}
          paceIsAhead={paceLeads.paceIsAhead}
          hasMeta={paceLeads.hasMeta}
          projecao={paceLeads.projecao}
          pctProjecao={paceLeads.pctProjecao}
          fmt={(n) => fmtInt.format(Math.round(n))}
        />
      </Cell>
    </>
  );

  return (
    <div className="space-y-4">
      {snap.longTerm && <LongTermGoalCard progress={snap.longTerm} accent={color} />}

      {/* 1) Placar + evolucao: a historia do mes de relance */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="panel p-5 xl:col-span-5 2xl:col-span-4 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <div className="eyebrow-label">{isQtd ? "Matriculas" : "Faturamento"}</div>
            <div className="text-[11px] text-white/40 capitalize">{monthName}</div>
          </div>

          <div className="mt-4 flex justify-center">
            <ScoreRing pct={pct} color={pctTone} />
          </div>

          {/* Dados em linhas alinhadas: rotulo a esquerda, valor a direita */}
          <div className="mt-5">
            <StatRow label={isQtd ? "Realizado" : "Total vendido"} value={isQtd ? fmtInt.format(t.qtd) : BRL.format(t.valor)} strong />
            <StatRow label="Meta" value={isQtd ? fmtInt.format(t.meta) : BRL.format(t.meta)} />
            <StatRow
              label={pct >= 100 ? "Status" : "Faltam"}
              value={pct >= 100 ? "Meta batida" : isQtd ? fmtInt.format(falta) : BRL.format(falta)}
              tone={pct >= 100 ? COLOR.ok : pctTone}
            />
            <PaceRows
              p={paceRealizado}
              fmt={(n) => (isQtd ? fmtInt.format(Math.round(n)) : BRL.format(n))}
            />
          </div>

        </section>

        <section className="panel p-5 xl:col-span-7 2xl:col-span-8 min-w-0 flex flex-col">
          <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
            <div>
              <div className="eyebrow-label">Evolucao diaria</div>
              <div className="text-xs text-white/45 mt-1">
                {isQtd ? "Matriculas" : "Vendas"} por dia, leads e % da meta acumulada
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/35">Tracejado = ritmo ideal ate o fim do mes</div>
          </div>
          <div className="flex-1 min-h-0">
          <UnifiedDailyChart
            data={buildUnifiedRows(series.daily, series.cumulative)}
            leftUnit={isQtd ? "int" : "currency"}
            rightUnit="percent"
            rightPercentScale
            showIdealReference
            today={day}
            height="fill"
            series={[
              { key: isQtd ? "qtd" : "valor", label: isQtd ? "Matriculas (dia)" : "Vendas (dia)", color, axis: "left", unit: isQtd ? "int" : "currency", strokeWidth: 2.5 },
              { key: "leads", label: "Leads (dia)", color: COLOR.info, axis: "left", unit: "int", strokeWidth: 2 },
              { key: "pct", label: "% Meta acumulada", color: pctTone, axis: "right", unit: "percent", strokeWidth: 3 },
              { key: "idealPct", label: "% Ideal", color: "#f0b44c", axis: "right", unit: "percent", dashed: true, strokeWidth: 1.5 },
            ]}
          />
          </div>
        </section>
      </div>

      {/* 2) Ritmo: faixa unica com o que muda dia a dia */}
      <section className="panel overflow-hidden">
        <div className={`-ml-px -mt-px grid grid-cols-2 md:grid-cols-3 ${isQtd ? "xl:grid-cols-4" : "xl:grid-cols-5"}`}>
          {ritmo}
        </div>
      </section>

      {/* Unicive: matriculas (secundaria) numa segunda faixa */}
      {bu === "unicive" && (
        <section className="panel overflow-hidden">
          <div className="-ml-px -mt-px grid grid-cols-1 md:grid-cols-3">
            <Cell
              label="Matriculas (real / meta)"
              value={`${fmtInt.format(t.qtd)} / ${fmtInt.format(t.metaQtd)}`}
              tone={COLOR.neutral}
            >
              <div className="mt-1">
                <ProgressBar
                  value={t.metaQtd > 0 ? (t.qtd / t.metaQtd) * 100 : 0}
                  color={t.metaQtd > 0 && t.qtd >= t.metaQtd ? COLOR.ok : COLOR.gold}
                  height={6}
                />
              </div>
              <div className="mt-1.5">
                {t.metaQtd > 0 ? fmtPct((t.qtd / t.metaQtd) * 100) : "—"}
                {" · "}
                {t.metaQtd > 0 && t.qtd >= t.metaQtd ? "Meta batida" : `Faltam ${fmtInt.format(Math.max(0, t.metaQtd - t.qtd))}`}
              </div>
              <PaceProjInfo
                paceDelta={paceQtd.paceDelta}
                paceIsAhead={paceQtd.paceIsAhead}
                hasMeta={paceQtd.hasMeta}
                projecao={paceQtd.projecao}
                pctProjecao={paceQtd.pctProjecao}
                fmt={(n) => fmtInt.format(Math.round(n))}
              />
            </Cell>
            <DayCell
              label="Meta do dia (matriculas)"
              meta={fmtInt.format(Math.round(t.metaDiaQtd))}
              hoje={fmtInt.format(Math.round(t.qtdHoje))}
              falta={fmtInt.format(Math.max(0, Math.round(t.metaDiaQtd - t.qtdHoje)))}
              ok={(t.qtdHoje >= t.metaDiaQtd && t.metaDiaQtd > 0) || Math.abs(t.qtdHoje - t.metaDiaQtd) < 0.5 || t.metaQtd === 0 || t.metaDiaQtd <= 0}
              zero="0"
            />
            <WeekCell
              label="Meta da semana (matriculas)"
              active={t.weekActive}
              target={t.weekTargetQtd}
              real={t.weekRealQtd}
              remaining={t.weekRemainingQtd}
              fmt={(n: number) => fmtInt.format(Math.round(n))}
              zero="0"
            />
          </div>
        </section>
      )}

      {/* 3) Receita por categoria */}
      {bu === "cppem" && <ProductRevenueBreakdown rows={breakdown} color={color} />}
      {bu === "unicive" && <UniciveCategoriasBreakdown rows={breakdown} />}
      {bu === "colegio_cppem" && <ColegioTurmasBreakdown rows={breakdown} />}
    </div>
  );
}

// ---------- Pecas do layout ----------

// Anel do placar: % da meta num relance, com brilho.
function ScoreRing({ pct, color, size = 188 }: { pct: number; color: string; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ filter: `drop-shadow(0 0 8px ${color}aa)`, transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display font-bold leading-none text-[2.4rem]" style={{ color }}>
            {fmtPct(pct)}
          </div>
          <div className="mt-1 font-ui text-[11px] uppercase tracking-[0.2em] text-white/45">da meta</div>
        </div>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cell p-4 min-w-0">
      <div className="kpi-label leading-tight">{label}</div>
      <div
        className="mt-1.5 font-display font-bold leading-none truncate text-[clamp(1.25rem,1.7vw,1.75rem)]"
        style={{ color: tone || COLOR.neutral }}
      >
        {value}
      </div>
      {children && <div className="mt-2 text-[11px] leading-snug text-white/50">{children}</div>}
    </div>
  );
}

function DayCell({
  label,
  meta,
  hoje,
  falta,
  ok,
  zero,
}: {
  label: string;
  meta: string;
  hoje: string;
  falta: string;
  ok: boolean;
  zero: string;
}) {
  return (
    <Cell label={label} value={meta} tone={COLOR.warning}>
      Hoje <b style={{ color: ok ? COLOR.ok : COLOR.neutral }}>{hoje}</b>
      <span className="mx-1.5 text-white/25">·</span>
      Falta <b style={{ color: ok ? COLOR.ok : COLOR.danger }}>{ok ? zero : falta}</b>
    </Cell>
  );
}

function WeekCell({
  label,
  active,
  target,
  real,
  remaining,
  fmt,
  zero,
}: {
  label: string;
  active: boolean;
  target: number;
  real: number;
  remaining: number;
  fmt: (n: number) => string;
  zero: string;
}) {
  if (!active || target <= 0) {
    return (
      <Cell label={label} value="—" tone={COLOR.mute}>
        {!active ? "Disponivel no mes atual" : "Sem meta definida"}
      </Cell>
    );
  }
  const batida = real >= target;
  return (
    <Cell label={label} value={fmt(target)} tone={batida ? COLOR.ok : COLOR.warning}>
      Feito <b style={{ color: batida ? COLOR.ok : COLOR.neutral }}>{fmt(real)}</b>
      <span className="mx-1.5 text-white/25">·</span>
      Falta <b style={{ color: batida ? COLOR.ok : COLOR.danger }}>{batida ? zero : fmt(remaining)}</b>
    </Cell>
  );
}

// Linha de dados do card do anel: rotulo a esquerda, valor a direita, divisoria fina.
function StatRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-t border-[var(--hair)] first:border-t-0">
      <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</span>
      <span
        className={`text-right tabular-nums ${strong ? "font-display font-bold text-xl" : "font-semibold text-[15px]"}`}
        style={{ color: tone || COLOR.neutral }}
      >
        {value}
      </span>
    </div>
  );
}

// Pace e projecao no mesmo formato das demais linhas.
function PaceRows({
  p,
  fmt,
}: {
  p: { paceDelta: number; paceIsAhead: boolean; hasMeta: boolean; projecao: number; pctProjecao: number };
  fmt: (n: number) => string;
}) {
  const paceColor = !p.hasMeta ? COLOR.mute : p.paceIsAhead ? COLOR.ok : COLOR.danger;
  const projColor = !p.hasMeta ? COLOR.mute : p.pctProjecao >= 100 ? COLOR.ok : COLOR.danger;
  const Arrow = p.paceIsAhead ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <div className="flex items-baseline justify-between gap-4 py-2.5 border-t border-[var(--hair)]">
        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">Pace</span>
        <span className="inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums" style={{ color: paceColor }}>
          {p.hasMeta ? (
            <>
              <Arrow className="w-3.5 h-3.5" />
              {p.paceIsAhead ? "+" : "-"}
              {fmt(Math.abs(p.paceDelta))}
            </>
          ) : (
            "—"
          )}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4 py-2.5 border-t border-[var(--hair)]">
        <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">Projecao</span>
        <span className="text-right text-[15px] font-semibold tabular-nums" style={{ color: projColor }}>
          {fmt(p.projecao)}
          {p.hasMeta ? <span className="text-white/60"> · {fmtPct(p.pctProjecao)}</span> : null}
        </span>
      </div>
    </>
  );
}

// Combina os arrays series.daily e series.cumulative (mesma qtd de dias)
// num unico array pro UnifiedDailyChart.
function buildUnifiedRows(
  daily: { day: string; valor: number; qtd: number; leads: number }[],
  cumulative: { day: string; pct: number; idealPct: number }[]
): UnifiedChartRow[] {
  const cumByDay = new Map(cumulative.map((c) => [c.day, c]));
  return daily.map((d) => {
    const c = cumByDay.get(d.day);
    return {
      day: d.day,
      valor: d.valor,
      qtd: d.qtd,
      leads: d.leads,
      pct: c ? c.pct : 0,
      idealPct: c ? c.idealPct : 0,
    };
  });
}

// Linha compacta de Pace + Projecao.
function PaceProjInfo({
  paceDelta,
  paceIsAhead,
  hasMeta,
  projecao,
  pctProjecao,
  fmt,
}: {
  paceDelta: number;
  paceIsAhead: boolean;
  hasMeta: boolean;
  projecao: number;
  pctProjecao: number;
  fmt: (n: number) => string;
}) {
  const paceColor = !hasMeta ? COLOR.mute : paceIsAhead ? COLOR.ok : COLOR.danger;
  const projColor = !hasMeta ? COLOR.mute : pctProjecao >= 100 ? COLOR.ok : COLOR.danger;
  const Arrow = paceIsAhead ? ArrowUpRight : ArrowDownRight;
  const paceAbs = fmt(Math.abs(paceDelta));
  return (
    <div className="mt-1 grid grid-cols-2 gap-1.5">
      <div className="rounded-md bg-panel2/70 px-2 py-1 flex items-center justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wider text-white/40">Pace</span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: paceColor }}>
          {hasMeta ? (
            <>
              <Arrow className="w-3 h-3" />
              {paceIsAhead ? "+" : "-"}{paceAbs}
            </>
          ) : "—"}
        </span>
      </div>
      <div className="rounded-md bg-panel2/70 px-2 py-1 flex items-center justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wider text-white/40">Projecao</span>
        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: projColor }}>
          {fmt(projecao)}{hasMeta ? ` · ${fmtPct(pctProjecao)}` : ""}
        </span>
      </div>
    </div>
  );
}
