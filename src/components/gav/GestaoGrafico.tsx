"use client";
/**
 * Card do faturamento dia a dia, com 3 visoes da MESMA receita (escolhe no canto
 * superior direito do cartao):
 *  - Por origem:    vendedores, direto, diretoria/grupo (e o que falta classificar)
 *  - Por BU:        CPPEM, UNICIVE, Colegio (e as do grupo sem BU)
 *  - Por categoria: cada linha de receita do Conta Azul
 * As barras sao empilhadas e a linha e o acumulado do mes. Recharts so no
 * navegador (ver `GestaoGraficoLazy`).
 */
import { useMemo, useState } from "react";
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
import {
  BU_GESTAO_ROTULO,
  BUS_GESTAO,
  COR_BU,
  COR_ORIGEM,
  ORIGENS,
  ORIGEM_ROTULO,
  PALETA_CATEGORIAS,
  type DiaGestao,
  type LinhaCategoria,
} from "@/lib/gestaoAVistaTipos";

type Visao = "origem" | "bu" | "categoria";
type Serie = { key: string; rotulo: string; cor: string };

const VISOES: { id: Visao; rotulo: string }[] = [
  { id: "origem", rotulo: "Por origem" },
  { id: "bu", rotulo: "Por BU" },
  { id: "categoria", rotulo: "Por categoria" },
];

const MAX_CATEGORIAS = 11; // o resto vira "Outras categorias"
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const compacto = (v: number) => `R$ ${Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)}`;

type Linha = Record<string, number | null> & { dia: number; total: number; acumulado: number | null };

function Dica({
  active,
  payload,
  label,
  series,
  rotulos,
}: {
  active?: boolean;
  payload?: { payload: Linha }[];
  label?: number;
  series: Serie[];
  rotulos: (string | undefined)[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const itens = series
    .map((s) => ({ ...s, v: Number(d[s.key] ?? 0) }))
    .filter((s) => s.v !== 0)
    .sort((a, b) => b.v - a.v);
  return (
    <div
      style={{
        background: "#14141b",
        border: "1px solid #4a4230",
        borderRadius: 12,
        padding: "10px 12px",
        fontSize: 12,
        minWidth: 220,
        maxWidth: 300,
        boxShadow: "0 18px 50px rgba(0,0,0,.55)",
      }}
    >
      <div style={{ color: COLOR.gold, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 11 }}>
        {rotulos[(label ?? 1) - 1] ?? `Dia ${label}`}
      </div>
      {itens.map((s) => (
        <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 4 }}>
          <span style={{ color: "#ada99b", display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: s.cor, display: "inline-block", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.rotulo}</span>
          </span>
          <b style={{ color: "#e8e4d9", fontWeight: 600 }}>{brl(s.v)}</b>
        </div>
      ))}
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

export default function GestaoGrafico({
  dias,
  categorias,
  anual = false,
}: {
  dias: DiaGestao[];
  categorias: LinhaCategoria[];
  /** Visao do ano: uma barra por mes (rotulos "Jan"...). */
  anual?: boolean;
}) {
  const [visao, setVisao] = useState<Visao>("origem");
  const rotulos = useMemo(() => dias.map((d) => d.rotulo), [dias]);

  const { series, linhas } = useMemo(() => {
    let series: Serie[] = [];
    const valorDe = (d: DiaGestao, key: string): number => {
      if (visao === "origem") return d.origem[key as keyof typeof d.origem] ?? 0;
      if (visao === "bu") return d.bu[key as keyof typeof d.bu] ?? 0;
      if (key === "__outras") return outras.reduce((s, k) => s + (d.categoria[k] ?? 0), 0);
      return d.categoria[key] ?? 0;
    };

    // Categorias: as maiores do mes ganham cor propria; o resto soma em "Outras".
    const ordenadas = [...categorias].sort((a, b) => b.valor - a.valor);
    const principais = ordenadas.slice(0, MAX_CATEGORIAS);
    const outras = ordenadas.slice(MAX_CATEGORIAS).map((c) => c.chave);

    if (visao === "origem") {
      series = ORIGENS.filter((o) => dias.some((d) => d.origem[o] !== 0)).map((o) => ({
        key: o,
        rotulo: ORIGEM_ROTULO[o],
        cor: COR_ORIGEM[o],
      }));
    } else if (visao === "bu") {
      series = BUS_GESTAO.filter((b) => dias.some((d) => d.bu[b] !== 0)).map((b) => ({
        key: b,
        rotulo: BU_GESTAO_ROTULO[b],
        cor: COR_BU[b],
      }));
    } else {
      series = principais.map((c, i) => ({ key: c.chave, rotulo: c.rotulo, cor: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length] }));
      if (outras.length) series.push({ key: "__outras", rotulo: "Outras categorias", cor: COLOR.mute });
    }

    const linhas: Linha[] = dias.map((d) => {
      const l: Linha = { dia: d.dia, total: d.total, acumulado: d.acumulado };
      for (const s of series) l[s.key] = valorDe(d, s.key);
      return l;
    });
    return { series, linhas };
  }, [visao, dias, categorias]);

  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow-label">{anual ? "Faturamento mês a mês" : "Faturamento dia a dia"}</div>
          <div className="mt-1 text-xs text-white/45">
            Receita de cada {anual ? "mês" : "dia"}, quebrada {visao === "origem" ? "por origem" : visao === "bu" ? "por BU" : "por categoria de receita"}, e o acumulado do {anual ? "ano" : "mês"}.
          </div>
        </div>
        {/* Escolhe a visao do grafico. */}
        <div role="tablist" aria-label="Visão do gráfico" className="inline-flex rounded-xl border border-border bg-panel p-1">
          {VISOES.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={visao === v.id}
              onClick={() => setVisao(v.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                visao === v.id ? "bg-accent text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {v.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 11, marginBottom: 8, color: "#ada99b" }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: s.cor, display: "inline-block" }} />
            {s.rotulo}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <i style={{ width: 16, height: 0, borderTop: `2px solid ${COLOR.neutral}`, display: "inline-block" }} />
          Acumulado do {anual ? "ano" : "mês"}
        </span>
      </div>

      <div className="h-[300px] sm:h-[400px] tv-grafico">
        <ResponsiveContainer>
          <ComposedChart data={linhas} margin={{ top: 12, left: 0, right: 8, bottom: 4 }} barCategoryGap="20%">
            <CartesianGrid stroke="#2d2c3a" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="dia" stroke="#87847a" fontSize={11} tickLine={false} axisLine={false} interval={anual ? 0 : "preserveStartEnd"} minTickGap={14} tickFormatter={(v: number) => rotulos[v - 1] ?? String(v)} />
            <YAxis yAxisId="dia" stroke="#87847a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compacto} width={60} />
            <YAxis yAxisId="acum" orientation="right" stroke="#87847a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compacto} width={60} />
            <Tooltip cursor={{ fill: "rgba(201,174,122,0.06)" }} content={<Dica series={series} rotulos={rotulos} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                yAxisId="dia"
                dataKey={s.key}
                stackId="r"
                fill={s.cor}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
                maxBarSize={28}
              />
            ))}
            <Line yAxisId="acum" type="monotone" dataKey="acumulado" stroke={COLOR.neutral} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
