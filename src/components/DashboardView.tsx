import type { DashboardSnapshot } from "@/lib/data";
import { BRL, fmtInt, fmtPct, paceProjection } from "@/lib/calc";
import { BU_COLOR, BU_LABEL, BU_THEME, COLOR, tonePctMeta } from "@/lib/brand";
import { isQtdPrimary } from "@/lib/products";
import BigStatCard from "@/components/BigStatCard";
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChart";
import ProductRevenueBreakdown from "@/components/ProductRevenueBreakdown";
import ColegioTurmasBreakdown from "@/components/ColegioTurmasBreakdown";
import UniciveCategoriasBreakdown from "@/components/UniciveCategoriasBreakdown";
import LongTermGoalCard from "@/components/LongTermGoalCard";
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
  const theme = BU_THEME[bu];
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

  return (
    <div
      className="space-y-3 rounded-2xl p-3 -m-1 relative overflow-hidden"
      style={{ backgroundImage: theme.bg }}
    >
      {/* Header da BU — compacto, so o titulo centralizado */}
      <div
        className="rounded-xl py-2 px-3 border border-white/5 text-center"
        style={{ backgroundImage: theme.headerBg }}
      >
        <h2 className="text-lg xl:text-xl font-bold tracking-tight">
          Dashboard {BU_LABEL[bu]}
        </h2>
      </div>

      {/* Card de META DE LONGO PRAZO — quando existe, aparece antes de
          tudo (e o principal indicador da BU no periodo definido). */}
      {snap.longTerm && (
        <LongTermGoalCard progress={snap.longTerm} accent={theme.accent2 || color} />
      )}

      {/* Linha 1 — KPIs principais. Colegio (isQtd) tem 5 cards; CPPEM e
          Unicive tem 4. */}
      <section className={`grid grid-cols-2 gap-3 ${isQtd ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {isQtd ? (
          <>
            <BigStatCard
              label="Matriculas"
              value={`${fmtInt.format(t.qtd)} / ${fmtInt.format(t.meta)}`}
              accent={COLOR.info}
              valueColor={COLOR.neutral}
              progressPct={pct}
              progressColor={pctTone}
              progressFooter={
                <>
                  <span>
                    <span style={{ color: pctTone }}>{fmtPct(pct)}</span>
                    <span className="text-white/40"> · {pct >= 100 ? "Meta batida" : `Faltam ${fmtInt.format(falta)}`}</span>
                  </span>
                  <PaceProjInfo
                    paceDelta={paceRealizado.paceDelta}
                    paceIsAhead={paceRealizado.paceIsAhead}
                    hasMeta={paceRealizado.hasMeta}
                    projecao={paceRealizado.projecao}
                    pctProjecao={paceRealizado.pctProjecao}
                    fmt={(n) => fmtInt.format(Math.round(n))}
                  />
                </>
              }
            />
            <BigStatCard
              label="Faturamento"
              value={`${BRL.format(t.valor)} / ${BRL.format(t.metaValor)}`}
              accent={COLOR.info}
              valueColor={COLOR.neutral}
              progressPct={pctFat}
              progressColor={pctFatTone}
              progressFooter={
                <>
                  <span>
                    <span style={{ color: pctFatTone }}>{fmtPct(pctFat)}</span>
                    <span className="text-white/40"> · {pctFat >= 100 ? "Meta de R$ batida" : `Faltam ${BRL.format(faltaFat)}`}</span>
                  </span>
                  <PaceProjInfo
                    paceDelta={paceValor.paceDelta}
                    paceIsAhead={paceValor.paceIsAhead}
                    hasMeta={paceValor.hasMeta}
                    projecao={paceValor.projecao}
                    pctProjecao={paceValor.pctProjecao}
                    fmt={(n) => BRL.format(n)}
                  />
                </>
              }
            />
            <BigStatCard
              label="% da Meta"
              value={fmtPct(pct)}
              accent={pctTone}
              valueColor={pctTone}
            />
            <MetaDoDiaCard
              isQtd={isQtd}
              metaDia={fmtMeta(metaDia)}
              realHoje={fmtMeta(realHoje)}
              falta={fmtMeta(faltaHoje)}
              diff={fmtMeta(Math.abs(diff))}
              placarLabel={placarLabel}
              placarColor={placarColor}
              vencendo={vencendo}
              empate={empate}
              semMeta={semMeta}
            />
            {/* 5o card do Colegio: Meta Dia em R$ (faturamento) */}
            <MetaDoDiaCard
              isQtd={false}
              metaDia={BRL.format(t.metaDiaValor)}
              realHoje={BRL.format(t.valorHoje)}
              falta={BRL.format(Math.max(0, t.metaDiaValor - t.valorHoje))}
              diff={BRL.format(Math.abs(t.valorHoje - t.metaDiaValor))}
              placarLabel={
                t.metaValor === 0
                  ? "Sem meta de R$ definida"
                  : t.valor >= t.metaValor
                  ? "Meta de R$ batida"
                  : t.metaDiaValor === 0
                  ? "No pace de R$"
                  : t.valorHoje >= t.metaDiaValor
                  ? "Vencendo o dia em R$"
                  : "Atras em R$ no dia"
              }
              placarColor={
                t.metaValor === 0
                  ? COLOR.mute
                  : t.valor >= t.metaValor
                  ? COLOR.ok
                  : t.valorHoje >= t.metaDiaValor
                  ? COLOR.ok
                  : COLOR.danger
              }
              vencendo={t.valorHoje >= t.metaDiaValor && t.metaDiaValor > 0}
              empate={Math.abs(t.valorHoje - t.metaDiaValor) < 0.01}
              semMeta={t.metaValor === 0 || t.metaDiaValor <= 0}
              labelOverride="Meta do Dia (Faturamento)"
            />
          </>
        ) : (
          <>
            <BigStatCard
              label="Total Vendido"
              value={BRL.format(t.valor)}
              accent={COLOR.info}
              valueColor={COLOR.neutral}
              progressPct={pct}
              progressColor={pctTone}
              progressFooter={
                <>
                  <span>
                    <span style={{ color: pctTone }}>{fmtPct(pct)}</span>
                    <span className="text-white/40"> · {pct >= 100 ? "Meta batida" : `Faltam ${BRL.format(falta)}`}</span>
                  </span>
                  <PaceProjInfo
                    paceDelta={paceRealizado.paceDelta}
                    paceIsAhead={paceRealizado.paceIsAhead}
                    hasMeta={paceRealizado.hasMeta}
                    projecao={paceRealizado.projecao}
                    pctProjecao={paceRealizado.pctProjecao}
                    fmt={(n) => BRL.format(n)}
                  />
                </>
              }
            />
            <BigStatCard
              label="Meta do Mes"
              value={BRL.format(t.meta)}
              accent={COLOR.info}
              valueColor={COLOR.neutral}
            />
            <BigStatCard
              label="% da Meta"
              value={fmtPct(pct)}
              accent={pctTone}
              valueColor={pctTone}
            />
            <MetaDoDiaCard
              isQtd={isQtd}
              metaDia={fmtMeta(metaDia)}
              realHoje={fmtMeta(realHoje)}
              falta={fmtMeta(faltaHoje)}
              diff={fmtMeta(Math.abs(diff))}
              placarLabel={placarLabel}
              placarColor={placarColor}
              vencendo={vencendo}
              empate={empate}
              semMeta={semMeta}
            />
          </>
        )}
      </section>

      {/* Linha 2 — Ticket, Conversao, Leads, Meta da Semana (qtd/R$).
          Colegio ganha +1 card: Meta da Semana (R$) pra equilibrar com
          a Linha 1 de 5 cards. */}
      <section
        className={`grid gap-3 grid-cols-2 ${
          isQtd ? "xl:grid-cols-5" : "xl:grid-cols-4"
        }`}
      >
        <CompareStatCard
          label="Ticket Medio"
          real={BRL.format(t.ticketReal)}
          meta={t.ticketMeta > 0 ? BRL.format(t.ticketMeta) : "—"}
          tone={ticketTone}
          legend={false}
        />
        <CompareStatCard
          label="Conversao"
          real={fmtPct(taxaConversao)}
          meta={convMetaBU > 0 ? fmtPct(convMetaBU) : "—"}
          tone={convTone}
          legend={false}
        />
        <CompareStatCard
          label="Leads no Mes"
          real={fmtInt.format(leadsTotal)}
          meta={leadsMeta > 0 ? fmtInt.format(leadsMeta) : "—"}
          tone={leadsTone}
          subtitle={leadsMeta > 0 ? fmtPct(leadsPct) + " da meta" : undefined}
          footer={
            <PaceProjInfo
              paceDelta={paceLeads.paceDelta}
              paceIsAhead={paceLeads.paceIsAhead}
              hasMeta={paceLeads.hasMeta}
              projecao={paceLeads.projecao}
              pctProjecao={paceLeads.pctProjecao}
              fmt={(n) => fmtInt.format(Math.round(n))}
            />
          }
        />
        <MetaDaSemanaCard
          isQtd={isQtd}
          fmtMeta={fmtMeta}
          weekActive={t.weekActive}
          weekStartDay={t.weekStartDay}
          weekEndDay={t.weekEndDay}
          weekTarget={t.weekTarget}
          weekReal={t.weekReal}
          weekRemaining={t.weekRemaining}
        />

        {/* COLEGIO: 5o card — Meta da Semana (R$) */}
        {isQtd && (
          <MetaDaSemanaCard
            isQtd={false}
            fmtMeta={(n: number) => BRL.format(n)}
            weekActive={t.weekActive}
            weekStartDay={t.weekStartDay}
            weekEndDay={t.weekEndDay}
            weekTarget={t.weekTargetValor}
            weekReal={t.weekRealValor}
            weekRemaining={t.weekRemainingValor}
            labelOverride="Meta da Semana (Faturamento)"
          />
        )}
      </section>

      {/* Linha 3 — So UNICIVE: 3 cards de matriculas (secundaria), bem
          distribuidos pra nao ficar aperto. */}
      {bu === "unicive" && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <BigStatCard
            label="Matriculas (Real / Meta)"
            value={`${fmtInt.format(t.qtd)} / ${fmtInt.format(t.metaQtd)}`}
            accent={COLOR.info}
            valueColor={COLOR.neutral}
            progressPct={t.metaQtd > 0 ? (t.qtd / t.metaQtd) * 100 : 0}
            progressColor={
              t.metaQtd > 0 && t.qtd >= t.metaQtd ? COLOR.ok : COLOR.info
            }
            progressFooter={
              <>
                <span>
                  <span
                    style={{
                      color: t.metaQtd > 0 && t.qtd >= t.metaQtd ? COLOR.ok : COLOR.neutral,
                    }}
                  >
                    {t.metaQtd > 0 ? fmtPct((t.qtd / t.metaQtd) * 100) : "—"}
                  </span>
                  <span className="text-white/40">
                    {" "}·{" "}
                    {t.metaQtd > 0 && t.qtd >= t.metaQtd
                      ? "Meta de matriculas batida"
                      : `Faltam ${fmtInt.format(Math.max(0, t.metaQtd - t.qtd))}`}
                  </span>
                </span>
                <PaceProjInfo
                  paceDelta={paceQtd.paceDelta}
                  paceIsAhead={paceQtd.paceIsAhead}
                  hasMeta={paceQtd.hasMeta}
                  projecao={paceQtd.projecao}
                  pctProjecao={paceQtd.pctProjecao}
                  fmt={(n) => fmtInt.format(Math.round(n))}
                />
              </>
            }
          />
          <MetaDoDiaCard
            isQtd={true}
            metaDia={fmtInt.format(Math.round(t.metaDiaQtd))}
            realHoje={fmtInt.format(Math.round(t.qtdHoje))}
            falta={fmtInt.format(Math.max(0, Math.round(t.metaDiaQtd - t.qtdHoje)))}
            diff={fmtInt.format(Math.abs(Math.round(t.qtdHoje - t.metaDiaQtd)))}
            placarLabel={
              t.metaQtd === 0
                ? "Sem meta de matriculas"
                : t.qtd >= t.metaQtd
                ? "Meta de matriculas batida"
                : t.metaDiaQtd === 0
                ? "No pace de matriculas"
                : t.qtdHoje >= t.metaDiaQtd
                ? "Vencendo em matriculas"
                : "Atras em matriculas"
            }
            placarColor={
              t.metaQtd === 0
                ? COLOR.mute
                : t.qtd >= t.metaQtd
                ? COLOR.ok
                : t.qtdHoje >= t.metaDiaQtd
                ? COLOR.ok
                : COLOR.danger
            }
            vencendo={t.qtdHoje >= t.metaDiaQtd && t.metaDiaQtd > 0}
            empate={Math.abs(t.qtdHoje - t.metaDiaQtd) < 0.5}
            semMeta={t.metaQtd === 0 || t.metaDiaQtd <= 0}
            labelOverride="Meta do Dia (Matriculas)"
          />
          <MetaDaSemanaCard
            isQtd={true}
            fmtMeta={(n: number) => fmtInt.format(Math.round(n))}
            weekActive={t.weekActive}
            weekStartDay={t.weekStartDay}
            weekEndDay={t.weekEndDay}
            weekTarget={t.weekTargetQtd}
            weekReal={t.weekRealQtd}
            weekRemaining={t.weekRemainingQtd}
            labelOverride="Meta da Semana (Matriculas)"
          />
        </section>
      )}

      {/* ===== Grafico unificado (Vendas + Leads + % Meta) — maior,
          3x o tamanho dos antigos, ocupando toda a linha ===== */}
      <section className="card-lg">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <div className="text-sm font-semibold">
              Evolucao Diaria — {BU_LABEL[bu]}
            </div>
            <div className="text-xs text-white/50">
              {isQtd ? "Matriculas" : "Vendas"}, leads e % da meta acumulada por dia
            </div>
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            Linha tracejada = ritmo ideal (100% ate o fim do mes)
          </div>
        </div>
        <UnifiedDailyChart
          data={buildUnifiedRows(series.daily, series.cumulative)}
          leftUnit={isQtd ? "int" : "currency"}
          rightUnit="percent"
          rightPercentScale
          showIdealReference
          today={day}
          series={[
            {
              key: isQtd ? "qtd" : "valor",
              label: isQtd ? "Matriculas (dia)" : "Vendas (dia)",
              color,
              axis: "left",
              unit: isQtd ? "int" : "currency",
              strokeWidth: 2.5,
            },
            {
              key: "leads",
              label: "Leads (dia)",
              color: COLOR.info,
              axis: "left",
              unit: "int",
              strokeWidth: 2,
            },
            {
              key: "pct",
              label: "% Meta acumulada",
              color: pctTone,
              axis: "right",
              unit: "percent",
              strokeWidth: 3,
            },
            {
              key: "idealPct",
              label: "% Ideal",
              color: "#f0b44c",
              axis: "right",
              unit: "percent",
              dashed: true,
              strokeWidth: 1.5,
            },
          ]}
        />
      </section>

      {/* Receita por categoria — abaixo do grafico unificado */}
      {bu === "cppem" && (
        <ProductRevenueBreakdown rows={breakdown} color={color} />
      )}

      {bu === "unicive" && (
        <UniciveCategoriasBreakdown rows={breakdown} />
      )}

      {bu === "colegio_cppem" && (
        <ColegioTurmasBreakdown rows={breakdown} />
      )}
    </div>
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

function CompareStatCard({
  label,
  real,
  meta,
  tone,
  subtitle,
  footer,
  legend = true,
}: {
  label: string;
  real: string;
  meta: string;
  tone: string;
  subtitle?: string;
  footer?: React.ReactNode;
  legend?: boolean;
}) {
  return (
    <div className="card-lg">
      <div className="kpi-label leading-tight">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
        <span className="big-num leading-none" style={{ color: tone }}>
          {real}
        </span>
        <span className="text-white/30 text-base xl:text-lg font-bold">/</span>
        <span className="text-base xl:text-lg font-bold text-white/40">{meta}</span>
      </div>
      {legend && (
        <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider leading-tight">
          real / meta{subtitle ? ` · ${subtitle}` : ""}
        </div>
      )}
      {footer}
    </div>
  );
}

function MetaDoDiaCard({
  isQtd,
  metaDia,
  realHoje,
  falta,
  diff,
  placarLabel,
  placarColor,
  vencendo,
  empate,
  semMeta,
  labelOverride,
}: {
  isQtd: boolean;
  metaDia: string;
  realHoje: string;
  falta: string;
  diff: string;
  placarLabel: string;
  placarColor: string;
  vencendo: boolean;
  empate: boolean;
  semMeta: boolean;
  labelOverride?: string;
}) {
  const Arrow = vencendo ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card-lg card-hover relative overflow-hidden">
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-[0.14] blur-3xl pointer-events-none"
        style={{ background: "#c9ae7a" }}
      />
      <div className="relative flex flex-col gap-1">
        <div className="kpi-label leading-tight">{labelOverride || "Meta do Dia"}</div>
        <div className="big-num leading-none" style={{ color: COLOR.warning }}>
          {metaDia}
        </div>
        {/* 3 quadrinhos internos: Meta, Hoje, Falta */}
        <div className="grid grid-cols-3 gap-1">
          <Mini label="Meta" value={metaDia} tone={COLOR.warning} />
          <Mini label="Hoje" value={realHoje} tone={vencendo ? COLOR.ok : COLOR.neutral} />
          <Mini
            label="Falta"
            value={vencendo || empate || semMeta ? (isQtd ? "0" : "R$ 0,00") : falta}
            tone={vencendo || empate || semMeta ? COLOR.ok : COLOR.danger}
          />
        </div>
      </div>
    </div>
  );
}

// Linha compacta de Pace + Projecao que cabe dentro dos cards de KPI
// sem estrapolar o layout.
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

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md bg-panel2 px-1.5 py-1 text-center">
      <div className="text-[9px] uppercase tracking-wider text-white/40 leading-tight">{label}</div>
      <div className="text-xs font-bold leading-tight mt-0.5" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function MetaDaSemanaCard({
  isQtd,
  fmtMeta,
  weekActive,
  weekStartDay,
  weekEndDay,
  weekTarget,
  weekReal,
  weekRemaining,
  labelOverride,
}: {
  isQtd: boolean;
  fmtMeta: (n: number) => string;
  weekActive: boolean;
  weekStartDay: number;
  weekEndDay: number;
  weekTarget: number;
  weekReal: number;
  weekRemaining: number;
  labelOverride?: string;
}) {
  if (!weekActive || weekTarget <= 0) {
    return (
      <div className="card-lg">
        <div className="kpi-label leading-tight">{labelOverride || "Meta da Semana"}</div>
        <div className="big-num text-white/40 leading-none">—</div>
        <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
          {!weekActive ? "Disponivel no mes atual" : "Sem meta definida"}
        </div>
      </div>
    );
  }

  const pct = weekTarget > 0 ? (weekReal / weekTarget) * 100 : 0;
  const batida = weekReal >= weekTarget;
  const tone = batida ? COLOR.ok : COLOR.warning;

  return (
    <div className="card-lg relative overflow-hidden">
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-[0.14] blur-3xl pointer-events-none"
        style={{ background: "#c9ae7a" }}
      />
      <div className="relative flex flex-col gap-1">
        <div className="kpi-label leading-tight">{labelOverride || "Meta da Semana"}</div>
        <div className="big-num leading-none" style={{ color: tone }}>
          {fmtMeta(weekRemaining)}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Mini label="Semana" value={fmtMeta(weekTarget)} tone={COLOR.warning} />
          <Mini label="Feito" value={fmtMeta(weekReal)} tone={batida ? COLOR.ok : COLOR.neutral} />
          <Mini
            label="Falta"
            value={batida ? (isQtd ? "0" : "R$ 0,00") : fmtMeta(weekRemaining)}
            tone={batida ? COLOR.ok : COLOR.danger}
          />
        </div>
      </div>
    </div>
  );
}
