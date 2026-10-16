"use client";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type UnifiedChartSeries = {
  key: string;              // nome do campo em `data`
  label: string;            // texto na legenda
  color: string;            // cor da serie
  axis: "left" | "right";   // qual eixo Y usa
  unit: "currency" | "int" | "percent";
  dashed?: boolean;         // linha pontilhada (ex: ideal)
  strokeWidth?: number;
  hidden?: boolean;         // nao renderiza mas mantem no tooltip
};

export type UnifiedChartRow = {
  day: string;
  [k: string]: string | number | undefined;
};

const GOLD = "#c9ae7a";
const GRID = "#2d2c3a";
const MUTED = "#87847a";
const WARN = "#f0b44c";
const OK = "#5fd08f";
const DANGER = "#ee7d73";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtInt = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const fmtPct = (v: number) => `${Number(v).toFixed(1)}%`;

function formatValue(unit: UnifiedChartSeries["unit"], v: number) {
  if (unit === "currency") return fmtBRL(v);
  if (unit === "percent") return fmtPct(v);
  return fmtInt(v);
}

function tickCompact(unit: UnifiedChartSeries["unit"]) {
  return (v: number) => {
    if (unit === "percent") return `${v}%`;
    const compact = Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v);
    return unit === "currency" ? `R$ ${compact}` : compact;
  };
}

// Tooltip proprio: dia, valor, leads e a diferenca para o ritmo ideal.
function ChartTooltip({
  active,
  payload,
  label,
  main,
  leads,
  pct,
  ideal,
}: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as UnifiedChartRow;
  const pctV = typeof row.pct === "number" ? row.pct : null;
  const idealV = typeof row.idealPct === "number" ? row.idealPct : null;
  const gap = pctV !== null && idealV !== null ? pctV - idealV : null;
  const line = (name: string, value: string, color: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginTop: 4 }}>
      <span style={{ color: "#ada99b", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <i style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
        {name}
      </span>
      <b style={{ color: "#e8e4d9", fontWeight: 600 }}>{value}</b>
    </div>
  );
  return (
    <div
      style={{
        background: "#14141b",
        border: "1px solid #4a4230",
        borderRadius: 12,
        padding: "10px 12px",
        fontSize: 12,
        minWidth: 200,
        boxShadow: "0 18px 50px rgba(0,0,0,.55)",
      }}
    >
      <div style={{ color: GOLD, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 11 }}>
        Dia {label}
      </div>
      {main && typeof row[main.key] === "number" && line(main.label, formatValue(main.unit, Number(row[main.key])), main.color)}
      {leads && typeof row[leads.key] === "number" && line(leads.label, formatValue(leads.unit, Number(row[leads.key])), leads.color)}
      {pct && pctV !== null && line(pct.label, fmtPct(pctV), pct.color)}
      {ideal && idealV !== null && line(ideal.label, fmtPct(idealV), ideal.color)}
      {gap !== null && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 7,
            borderTop: "1px solid #3b3524",
            color: gap >= 0 ? OK : DANGER,
            fontWeight: 700,
          }}
        >
          {gap >= 0 ? "▲" : "▼"} {Math.abs(gap).toFixed(1)} p.p. {gap >= 0 ? "acima" : "abaixo"} do ritmo ideal
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, kind }: { color: string; label: string; kind: "bar" | "area" | "dash" | "dot" }) {
  const swatch =
    kind === "bar" ? (
      <i style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
    ) : kind === "area" ? (
      <i style={{ width: 16, height: 3, borderRadius: 2, background: color, display: "inline-block", boxShadow: `0 0 8px ${color}` }} />
    ) : (
      <i
        style={{
          width: 16,
          height: 0,
          borderTop: `2px ${kind === "dot" ? "dotted" : "dashed"} ${color}`,
          display: "inline-block",
        }}
      />
    );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#ada99b" }}>
      {swatch}
      {label}
    </span>
  );
}

export default function UnifiedDailyChart({
  data,
  series,
  leftUnit = "currency",
  rightUnit = "percent",
  rightDomain,
  rightPercentScale = false,
  showIdealReference = false,
  height = 460,
  today,
}: {
  data: UnifiedChartRow[];
  series: UnifiedChartSeries[];
  leftUnit?: UnifiedChartSeries["unit"];
  rightUnit?: UnifiedChartSeries["unit"];
  rightDomain?: [number | string, number | string];
  // Eixo direito de 0 ate pelo menos 100%, arredondado pra dezena de cima.
  // Fica aqui (e nao como prop) porque funcao nao atravessa de Server
  // Component pra Client Component.
  rightPercentScale?: boolean;
  showIdealReference?: boolean;
  height?: number;
  // Dia do mes "de hoje" (1-based). Corta o realizado ali e projeta o fim do mes.
  today?: number;
}) {
  const leads = series.find((s) => s.key === "leads");
  const pct = series.find((s) => s.key === "pct");
  const ideal = series.find((s) => s.key === "idealPct");
  const main = series.find((s) => s.axis === "left" && s.key !== "leads");

  const todayIdx = today && today >= 1 && today <= data.length ? today - 1 : null;
  const pctToday = todayIdx !== null && pct ? Number(data[todayIdx]?.[pct.key] ?? 0) : null;
  const dailyPace = todayIdx !== null && pctToday !== null && today ? pctToday / today : null;
  const projectedEnd =
    todayIdx !== null && dailyPace !== null && todayIdx < data.length - 1 ? dailyPace * data.length : null;

  // Realizado para no dia de hoje; a projecao sai dali em linha reta (media diaria).
  const rows = data.map((r, i) => {
    const out: UnifiedChartRow = { ...r };
    if (todayIdx !== null && pct && i > todayIdx) {
      out[pct.key] = undefined;
      if (main) out[main.key] = undefined;
      if (leads) out[leads.key] = undefined;
    }
    if (todayIdx !== null && dailyPace !== null && pctToday !== null && i >= todayIdx) {
      out.proj = pctToday + dailyPace * (i - todayIdx);
    }
    return out;
  });

  // Em tela cheia (modo TV) o grafico se ajusta a altura da tela, pra aparecer
  // inteiro sem rolar — mesmo nas BUs com mais cards acima dele.
  const areaRef = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const compute = () => {
      if (!document.documentElement.classList.contains("tv-mode")) {
        setFitHeight(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return; // slide escondido no carrossel
      const topInPage = rect.top + window.scrollY;
      const available = Math.floor(window.innerHeight - topInPage - 24);
      setFitHeight(Math.max(170, Math.min(height, available)));
    };
    compute();
    window.addEventListener("resize", compute);
    document.addEventListener("fullscreenchange", compute);
    const classWatch = new MutationObserver(compute);
    classWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const sizeWatch = new ResizeObserver(compute);
    sizeWatch.observe(el);
    sizeWatch.observe(document.body);
    // O carrossel mostra/esconde as abas sem disparar resize: remede de tempos em tempos.
    const poll = setInterval(compute, 700);
    return () => {
      clearInterval(poll);
      window.removeEventListener("resize", compute);
      document.removeEventListener("fullscreenchange", compute);
      classWatch.disconnect();
      sizeWatch.disconnect();
    };
  }, [height]);

  const hasRight = series.some((s) => s.axis === "right" && !s.hidden);
  const todayLabel = todayIdx !== null ? data[todayIdx]?.day : undefined;
  const lastLabel = data[data.length - 1]?.day;
  const pctColor = pct?.color ?? DANGER;
  const barColor = main?.color ?? GOLD;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 11, marginBottom: 8 }}>
        {main && <LegendItem kind="bar" color={barColor} label={main.label} />}
        {pct && <LegendItem kind="area" color={pctColor} label={pct.label} />}
        {ideal && <LegendItem kind="dash" color={WARN} label={ideal.label} />}
        {projectedEnd !== null && <LegendItem kind="dash" color={pctColor} label="Projeção no ritmo atual" />}
        {leads && <LegendItem kind="dot" color={leads.color} label={leads.label} />}
      </div>

      <div ref={areaRef} style={{ height: fitHeight ?? height }}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 18, left: 0, right: hasRight ? 8 : 0, bottom: 4 }} barCategoryGap="22%">
            <defs>
              <linearGradient id="udc_bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
                <stop offset="100%" stopColor={barColor} stopOpacity={0.25} />
              </linearGradient>
              <linearGradient id="udc_pct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={pctColor} stopOpacity={0.38} />
                <stop offset="100%" stopColor={pctColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="day"
              stroke={MUTED}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              yAxisId="left"
              stroke={MUTED}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={tickCompact(leftUnit)}
              width={56}
            />
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={MUTED}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={tickCompact(rightUnit)}
                width={44}
                domain={
                  (rightPercentScale
                    ? [
                        0,
                        (dataMax: number) =>
                          Math.max(100, Math.ceil(Math.max(dataMax, projectedEnd ?? 0) / 10) * 10),
                      ]
                    : rightDomain) as any
                }
              />
            )}
            {leads && <YAxis yAxisId="leads" hide domain={[0, (m: number) => Math.ceil(m * 1.15)]} />}

            <Tooltip
              cursor={{ stroke: GOLD, strokeOpacity: 0.35, strokeDasharray: "3 4" }}
              content={<ChartTooltip main={main} leads={leads} pct={pct} ideal={ideal} />}
            />

            {showIdealReference && hasRight && (
              <ReferenceLine y={100} yAxisId="right" stroke={WARN} strokeDasharray="3 4" strokeOpacity={0.5}
                label={{ value: "META", position: "insideTopLeft", fill: WARN, fontSize: 10, fontWeight: 700 }} />
            )}
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                yAxisId="left"
                stroke={GOLD}
                strokeOpacity={0.55}
                label={{ value: "HOJE", position: "top", fill: GOLD, fontSize: 10, fontWeight: 700 }}
              />
            )}

            {main && (
              <Bar
                yAxisId="left"
                dataKey={main.key}
                name={main.label}
                fill="url(#udc_bar)"
                radius={[5, 5, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            )}
            {leads && (
              <Line
                yAxisId="leads"
                type="linear"
                dataKey={leads.key}
                name={leads.label}
                stroke={leads.color}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeDasharray="1 4"
                strokeLinecap="round"
                dot={false}
                connectNulls
              />
            )}
            {ideal && (
              <Line
                yAxisId="right"
                type="linear"
                dataKey={ideal.key}
                name={ideal.label}
                stroke={WARN}
                strokeOpacity={0.8}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
            {projectedEnd !== null && (
              <Line
                yAxisId="right"
                type="linear"
                dataKey="proj"
                name="Projeção"
                stroke={pctColor}
                strokeOpacity={0.7}
                strokeWidth={2}
                strokeDasharray="2 5"
                strokeLinecap="round"
                dot={false}
                activeDot={false}
              />
            )}
            {pct && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey={pct.key}
                name={pct.label}
                stroke={pctColor}
                strokeWidth={3}
                fill="url(#udc_pct)"
                dot={false}
                activeDot={{ r: 5, stroke: "#0e0e14", strokeWidth: 2, fill: pctColor }}
                style={{ filter: `drop-shadow(0 0 7px ${pctColor}aa)` }}
                connectNulls={false}
              />
            )}

            {todayLabel && pct && pctToday !== null && (
              <ReferenceDot
                x={todayLabel}
                y={pctToday}
                yAxisId="right"
                r={5}
                fill={pctColor}
                stroke="#0e0e14"
                strokeWidth={2}
                label={{ value: fmtPct(pctToday), position: "right", fill: pctColor, fontSize: 13, fontWeight: 700, offset: 10 }}
              />
            )}
            {lastLabel && projectedEnd !== null && (
              <ReferenceDot
                x={lastLabel}
                y={projectedEnd}
                yAxisId="right"
                r={4}
                fill="#0e0e14"
                stroke={pctColor}
                strokeWidth={2}
                label={{ value: `Proj. ${projectedEnd.toFixed(0)}%`, position: "top", fill: pctColor, fontSize: 11, fontWeight: 700 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
