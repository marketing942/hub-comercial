"use client";
/**
 * O UNICO grafico do painel GAV: receita acumulada do mes x o ritmo que leva a
 * meta da empresa (dias uteis), com a meta como teto. As barras discretas sao o
 * faturamento de cada dia. Recharts so no navegador (ver `GavGraficoLazy`).
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { COLOR } from "@/lib/brand";

export type PontoGav = { dia: number; diario: number; acumulado: number | null; ideal: number | null };

const curto = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v >= 1_000
      ? `${Math.round(v / 1_000)} mil`
      : String(Math.round(v));
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function GavGrafico({ pontos, meta }: { pontos: PontoGav[]; meta: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#2d2c3a" vertical={false} />
        <XAxis dataKey="dia" tick={{ fill: "#87847a", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          yAxisId="acc"
          tick={{ fill: "#87847a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={curto}
          domain={[0, (max: number) => Math.max(max, meta) * 1.05]}
        />
        <YAxis yAxisId="dia" hide domain={[0, (max: number) => max * 3]} />
        <Tooltip
          cursor={{ fill: "rgba(201,174,122,0.06)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PontoGav;
            const dif = p.acumulado != null && p.ideal != null ? p.acumulado - p.ideal : null;
            return (
              <div className="rounded-lg border border-[#4a4230] bg-[#14141b] px-3 py-2 text-xs shadow-xl">
                <div className="mb-1 font-ui font-bold uppercase tracking-[0.12em] text-accent">Dia {label}</div>
                <div className="tabular-nums text-white/80">No dia: {brl(p.diario)}</div>
                {p.acumulado != null && <div className="tabular-nums">Acumulado: {brl(p.acumulado)}</div>}
                {p.ideal != null && <div className="tabular-nums text-white/60">Ritmo da meta: {brl(p.ideal)}</div>}
                {dif != null && (
                  <div className="tabular-nums font-semibold" style={{ color: dif >= 0 ? COLOR.ok : COLOR.danger }}>
                    {dif >= 0 ? "+" : "−"}
                    {brl(Math.abs(dif))} {dif >= 0 ? "acima" : "abaixo"} do ritmo
                  </div>
                )}
              </div>
            );
          }}
        />
        <Bar yAxisId="dia" dataKey="diario" fill={COLOR.gold} fillOpacity={0.28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        {meta > 0 && (
          <ReferenceLine
            yAxisId="acc"
            y={meta}
            stroke={COLOR.mute}
            strokeDasharray="2 4"
            label={{ value: "META", position: "insideTopLeft", fill: COLOR.mute, fontSize: 10 }}
          />
        )}
        {meta > 0 && (
          <Line yAxisId="acc" dataKey="ideal" stroke={COLOR.warning} strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        )}
        <Line yAxisId="acc" dataKey="acumulado" stroke={COLOR.gold} strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
