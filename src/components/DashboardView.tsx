import type { DashboardSnapshot } from "@/lib/data";
import { BRL, fmtInt, fmtPct, paceProjection } from "@/lib/calc";
import { BU_COLOR, COLOR, tonePctMeta } from "@/lib/brand";
import { isQtdPrimary } from "@/lib/products";
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChartLazy";
import LongTermGoalCard from "@/components/LongTermGoalCard";
import Indicador, { type Linha } from "@/components/Indicador";
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
  const { bu, series, sellers, leadsTotal, taxaConversao } = snap;
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

  // Meta do dia
  const metaDia = t.metaDia;
  const realHoje = t.realizadoHoje;
  const faltaHoje = Math.max(0, metaDia - realHoje);
  const semMeta = metaDia <= 0 || t.meta === 0;

  const totalVendas = sellers.reduce((a, b) => a + b.vendasCount, 0);
  const leadsMeta = t.leadsMeta;
  const leadsPct = leadsMeta > 0 ? (leadsTotal / leadsMeta) * 100 : 0;

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

  // ---- Faixa de indicadores: TODAS as celulas no mesmo padrao (25/11/2026) ----
  // Rotulo · numero principal (sempre o REALIZADO, unico com cor) · linhas
  // "rotulo ... valor" sem cor. Cor: verde = bateu/no ritmo, vermelho = atras,
  // branco = em andamento ou sem meta. Sem barras de progresso.
  const isUni = bu === "unicive";
  const fmtQ = (n: number) => fmtInt.format(Math.round(n));
  const sinal = (v: number) => (v >= 0 ? "+" : "−");
  const tomRitmoMes = (p: { hasMeta: boolean; paceIsAhead: boolean }, batida: boolean) =>
    !p.hasMeta ? COLOR.neutral : batida || p.paceIsAhead ? COLOR.ok : COLOR.danger;
  const linhasRitmo = (p: { hasMeta: boolean; paceDelta: number; projecao: number }, fmt: (n: number) => string): Linha[] =>
    p.hasMeta
      ? [
          ["Pace", `${sinal(p.paceDelta)}${fmt(Math.abs(p.paceDelta))}`],
          ["Projecao", fmt(p.projecao)],
        ]
      : [];

  const hojeBatido = !semMeta && realHoje >= metaDia;
  const linhasHoje: Linha[] = semMeta
    ? [["Meta do dia", "Sem meta"]]
    : [
        ["Meta do dia", fmtMeta(metaDia)],
        ["Falta", hojeBatido ? "Batida" : fmtMeta(faltaHoje)],
      ];
  if (isQtd) linhasHoje.push(["R$ hoje", `${BRL.format(t.valorHoje)} / ${BRL.format(t.metaDiaValor)}`]);
  if (isUni) linhasHoje.push(["Matric. hoje", `${fmtQ(t.qtdHoje)} / ${fmtQ(t.metaDiaQtd)}`]);

  const semanaAtiva = t.weekActive && t.weekTarget > 0;
  const semanaBatida = semanaAtiva && t.weekReal >= t.weekTarget;
  const linhasSemana: Linha[] = !t.weekActive
    ? [["Meta da semana", "So no mes atual"]]
    : !semanaAtiva
      ? [["Meta da semana", "Sem meta"]]
      : [
          ["Meta da semana", fmtMeta(t.weekTarget)],
          ["Falta", semanaBatida ? "Batida" : fmtMeta(t.weekRemaining)],
        ];
  if (t.weekActive && isQtd && t.weekTargetValor > 0) linhasSemana.push(["R$ semana", `${BRL.format(t.weekRealValor)} / ${BRL.format(t.weekTargetValor)}`]);
  if (t.weekActive && isUni && t.weekTargetQtd > 0) linhasSemana.push(["Matric. semana", `${fmtQ(t.weekRealQtd)} / ${fmtQ(t.weekTargetQtd)}`]);

  const ritmo = (
    <>
      {isQtd && (
        <Indicador
          label="Faturamento"
          value={BRL.format(t.valor)}
          tone={tomRitmoMes(paceValor, t.metaValor > 0 && t.valor >= t.metaValor)}
          linhas={[
            ["Meta", t.metaValor > 0 ? `${BRL.format(t.metaValor)} · ${fmtPct(pctFat)}` : "Sem meta"],
            ...linhasRitmo(paceValor, (n) => BRL.format(n)),
          ]}
        />
      )}
      {isUni && (
        <Indicador
          label="Matriculas"
          value={fmtQ(t.qtd)}
          tone={tomRitmoMes(paceQtd, t.metaQtd > 0 && t.qtd >= t.metaQtd)}
          linhas={[
            ["Meta", t.metaQtd > 0 ? `${fmtQ(t.metaQtd)} · ${fmtPct((t.qtd / t.metaQtd) * 100)}` : "Sem meta"],
            ...linhasRitmo(paceQtd, fmtQ),
          ]}
        />
      )}
      <Indicador
        label={isQtd ? "Hoje (matriculas)" : "Vendido hoje"}
        value={fmtMeta(realHoje)}
        tone={hojeBatido ? COLOR.ok : COLOR.neutral}
        linhas={linhasHoje}
      />
      <Indicador
        label={isQtd ? "Semana (matriculas)" : "Vendido na semana"}
        value={t.weekActive ? fmtMeta(t.weekReal) : "—"}
        tone={semanaBatida ? COLOR.ok : COLOR.neutral}
        linhas={linhasSemana}
      />
      <Indicador
        label="Ticket medio"
        value={BRL.format(t.ticketReal)}
        tone={ticketTone}
        linhas={[["Meta", t.ticketMeta > 0 ? BRL.format(t.ticketMeta) : "Sem meta"]]}
      />
      <Indicador
        label="Conversao"
        value={fmtPct(taxaConversao)}
        tone={convTone}
        linhas={[
          ["Meta", convMetaBU > 0 ? fmtPct(convMetaBU) : "Sem meta"],
          ["Vendas / leads", `${fmtQ(totalVendas)} / ${fmtQ(leadsTotal)}`],
        ]}
      />
      <Indicador
        label="Leads no mes"
        value={fmtQ(leadsTotal)}
        tone={tomRitmoMes(paceLeads, leadsMeta > 0 && leadsTotal >= leadsMeta)}
        linhas={[
          ["Meta", leadsMeta > 0 ? `${fmtQ(leadsMeta)} · ${fmtPct(leadsPct)}` : "Sem meta"],
          ...linhasRitmo(paceLeads, fmtQ),
        ]}
      />
    </>
  );

  return (
    <div className="space-y-2">
      {snap.longTerm && <LongTermGoalCard progress={snap.longTerm} accent={color} />}

      {/* 1) Placar + evolucao: a historia do mes de relance */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
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
          <div className="eyebrow-label mb-2">Evolucao diaria</div>
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
              { key: "pct", label: "% Meta acumulada", color: pctTone, axis: "right", unit: "percent", strokeWidth: 3 },
              { key: "idealPct", label: "% Ideal", color: "#f0b44c", axis: "right", unit: "percent", dashed: true, strokeWidth: 1.5 },
            ]}
          />
          </div>
        </section>
      </div>

      {/* 2) Ritmo: UMA faixa so em todas as BUs (a metrica secundaria vai como sublinha) */}
      <section className="panel overflow-hidden">
        <div className={`-ml-px -mt-px grid grid-cols-2 md:grid-cols-3 ${isQtd || isUni ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
          {ritmo}
        </div>
      </section>


      {/* A receita por categoria/linha fica so no GAV (25/11/2026). */}
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
          style={{ transition: "stroke-dashoffset 700ms ease" }}
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
