"use client";
/**
 * Faturamento dia a dia do mes: barras empilhadas por origem (vendedores, direto,
 * diretoria) + linha do acumulado. Recharts so no navegador (ver
 * `GestaoDiariaLazy`).
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { COLOR } from "@/lib/brand";
import { COR_ORIGEM, ORIGEM_ROTULO, type DiaGestao, type Origem } from "@/lib/gestaoAVistaTipos";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const compacto = (v: number) => `R$ ${Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)}`;

function Dica({ active, payload, label }: { active?: boolean; payload?: { payload: DiaGestao }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const linha = (nome: string, valor: number, cor: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginTop: 4 }}>
      <span style={{ color: "#ada99b", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <i style={{ width: 8, height: 8, borderRadius: 2, background: cor, display: "inline-block" }} />
        {nome}
      </span>
      <b style={{ color: "#e8e4d9", fontWeight: 600 }}>{brl(valor)}</b>
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
        minWidth: 210,
        boxShadow: "0 18px 50px rgba(0,0,0,.55)",
      }}
    >
      <div style={{ color: COLOR.gold, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 11 }}>
        Dia {label}
      </div>
      {(Object.keys(ORIGEM_ROTULO) as Origem[]).map((o) => linha(ORIGEM_ROTULO[o], d[o], COR_ORIGEM[o]))}
      <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px solid #3b3524", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#ada99b" }}>Total do dia</span>
        <b style={{ color: "#e8e4d9" }}>{brl(d.total)}</b>
      </div>
      {d.acumulado !== null && (
        <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#ada99b" }}>Acumulado</span>
          <b style={{ color: "#e8e4d9" }}>{brl(d.acumulado)}</b>
        </div>
      )}
    </div>
  );
}

export default function GestaoDiaria({ dias }: { dias: DiaGestao[] }) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 11, marginBottom: 8, color: "#ada99b" }}>
        {(Object.keys(ORIGEM_ROTULO) as Origem[]).map((o) => (
          <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: COR_ORIGEM[o], display: "inline-block" }} />
            {ORIGEM_ROTULO[o]}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <i style={{ width: 16, height: 0, borderTop: `2px solid ${COLOR.neutral}`, display: "inline-block" }} />
          Acumulado do mes
        </span>
      </div>
      <div className="h-[300px] sm:h-[380px]">
        <ResponsiveContainer>
          <ComposedChart data={dias} margin={{ top: 12, left: 0, right: 8, bottom: 4 }} barCategoryGap="20%">
            <CartesianGrid stroke="#2d2c3a" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="dia" stroke="#87847a" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
            <YAxis yAxisId="dia" stroke="#87847a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compacto} width={60} />
            <YAxis yAxisId="acum" orientation="right" stroke="#87847a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compacto} width={60} />
            <Tooltip cursor={{ fill: "rgba(201,174,122,0.06)" }} content={<Dica />} />
            <Bar yAxisId="dia" dataKey="vendedores" stackId="r" fill={COR_ORIGEM.vendedores} isAnimationActive={false} maxBarSize={26} />
            <Bar yAxisId="dia" dataKey="direto" stackId="r" fill={COR_ORIGEM.direto} isAnimationActive={false} maxBarSize={26} />
            <Bar yAxisId="dia" dataKey="diretoria" stackId="r" fill={COR_ORIGEM.diretoria} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={26} />
            <Line yAxisId="acum" type="monotone" dataKey="acumulado" stroke={COLOR.neutral} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
