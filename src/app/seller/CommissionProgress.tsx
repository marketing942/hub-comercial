"use client";
/**
 * Jornada da comissao como uma SUBIDA de montanha (Meu Painel → Minha comissao).
 *
 * A trilha sobe em ziguezague do pe (0% da meta) ao cume (a maior faixa). Cada
 * faixa de comissao e uma bandeira na trilha; o trecho ja percorrido fica na
 * cor da BU e o avatar do vendedor anda junto com o % da meta. Passou da maior
 * faixa = esta no cume.
 *
 * Desenho: o SVG estica (preserveAspectRatio="none") para ocupar o card todo, e
 * bandeiras/avatar sao HTML posicionados em % das mesmas coordenadas — assim os
 * textos nunca deformam.
 */
import { fmtPct } from "@/lib/calc";
import type { CommissionRules } from "@/lib/commission";
import { Flag, Mountain, Zap } from "lucide-react";

const W = 1000;
const H = 400;

/** Silhueta da montanha principal e da cadeia ao fundo (coordenadas do viewBox). */
const MONTANHA = "0,400 170,250 250,280 470,115 555,165 720,18 870,185 1000,130 1000,400";
const FUNDO = "0,400 0,300 120,230 300,280 430,180 600,250 800,120 1000,210 1000,400";

/** Trilha em ziguezague, do pe ao cume (sempre por dentro da montanha). */
const TRILHA: [number, number][] = [
  [70, 382],
  [390, 335],
  [255, 300],
  [520, 230],
  [440, 192],
  [655, 128],
  [720, 34],
];

/** Fracao da trilha no meio do 1o trecho: onde fica a 1a faixa de comissao. */
const PRIMEIRA = (() => {
  const seg = TRILHA.slice(1).map((p, i) => Math.hypot(p[0] - TRILHA[i][0], p[1] - TRILHA[i][1]));
  return seg[0] / 2 / seg.reduce((a, b) => a + b, 0);
})();

const fmtPctBR = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Ponto da trilha na fracao f (0..1) do comprimento total. */
function pontoNaTrilha(f: number): [number, number] {
  const seg = TRILHA.slice(1).map((p, i) => Math.hypot(p[0] - TRILHA[i][0], p[1] - TRILHA[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let alvo = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (alvo <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(1, alvo / seg[i]) : 0;
      const [x0, y0] = TRILHA[i];
      const [x1, y1] = TRILHA[i + 1];
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    alvo -= seg[i];
  }
  return TRILHA[TRILHA.length - 1];
}

export default function CommissionProgress({
  color,
  rules,
  pctMeta,
  avatarUrl,
  avatarInitial,
  avatarColor,
}: {
  color: string;
  rules: CommissionRules;
  pctMeta: number;
  avatarUrl?: string | null;
  avatarInitial: string;
  avatarColor: string;
  /** Mantido por compatibilidade: a jornada sempre vai dentro do card do Meu Painel. */
  semCard?: boolean;
}) {
  const faixas = [...rules.tiers].sort((a, b) => a.meta_pct - b.meta_pct);
  const n = faixas.length;

  // Escala por trecho: a 1a faixa fica no meio do 1o tracinho da trilha e as
  // demais igualmente espacadas ate o cume (a ultima faixa). Assim as bandeiras
  // nao se amontoam no alto quando as faixas comecam em 80%.
  const paradas: [number, number][] = [[0, 0]];
  faixas.forEach((t, i) => paradas.push([t.meta_pct, n === 1 ? 1 : PRIMEIRA + ((1 - PRIMEIRA) * i) / (n - 1)]));
  if (n === 0) paradas.push([100, 1]);
  const fracao = (pct: number) => {
    if (pct <= 0) return 0;
    for (let i = 1; i < paradas.length; i++) {
      const [p0, f0] = paradas[i - 1];
      const [p1, f1] = paradas[i];
      if (pct <= p1) return f0 + ((f1 - f0) * (pct - p0)) / Math.max(1e-9, p1 - p0);
    }
    return 1;
  };

  const fAtual = fracao(pctMeta);
  const [ax, ay] = pontoNaTrilha(fAtual);
  const noCume = n > 0 && pctMeta >= faixas[n - 1].meta_pct;
  const pts = TRILHA.map((p) => p.join(",")).join(" ");

  return (
    // pt-16: espaco para o avatar quando ele chega no cume
    <div className="flex-1 flex flex-col min-h-[280px] pt-14 pb-1">
    <div className="relative flex-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="mont-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(201,174,122,0.30)" />
            <stop offset="100%" stopColor="rgba(201,174,122,0.02)" />
          </linearGradient>
          <linearGradient id="fundo-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <polygon points={FUNDO} fill="url(#fundo-g)" />
        <polygon points={MONTANHA} fill="url(#mont-g)" stroke="rgba(201,174,122,0.35)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {/* neve no cume */}
        <polygon points="720,18 680,66 698,59 711,72 728,57 746,70 760,64" fill="rgba(240,220,176,0.55)" />
        {/* trilha inteira (pontilhada) e o trecho ja percorrido (cheio, na cor da BU) */}
        <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} strokeDasharray="5 8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray={`${fAtual} 1`}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dasharray 900ms ease" }}
        />
      </svg>

      {/* Pe da montanha */}
      <div className="absolute -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-white/35" style={{ left: `${(TRILHA[0][0] / W) * 100}%`, top: `${(TRILHA[0][1] / H) * 100 + 7}%` }}>
        Inicio
      </div>

      {/* Bandeiras das faixas */}
      {faixas.map((t, i) => {
        const [x, y] = pontoNaTrilha(fracao(t.meta_pct));
        const ok = pctMeta >= t.meta_pct;
        const cume = i === n - 1;
        // rotulo a direita da bandeira (o avatar fica em cima do ponto dele, entao
        // nao cobre o rotulo da proxima faixa); so o do cume vai a esquerda.
        const direita = !cume;
        return (
          <div key={t.meta_pct} className="absolute" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full border-2"
              style={{
                width: cume ? 26 : 20,
                height: cume ? 26 : 20,
                background: ok ? color : "#14141b",
                borderColor: ok ? color : "rgba(255,255,255,0.3)",
                boxShadow: ok ? `0 0 10px ${color}` : undefined,
              }}
            >
              {cume ? (
                <Flag className="h-3 w-3" style={{ color: ok ? "#000" : "rgba(255,255,255,0.6)" }} />
              ) : ok ? (
                <Zap className="h-2.5 w-2.5 text-black" />
              ) : null}
            </div>
            <div
              className={`absolute top-0 -translate-y-1/2 whitespace-nowrap rounded-md border px-1.5 py-0.5 leading-tight ${direita ? "left-4" : "right-4 text-right"}`}
              style={{ borderColor: ok ? `${color}66` : "rgba(255,255,255,0.1)", background: "rgba(14,14,20,0.85)" }}
            >
              <div className="text-[12px] font-bold tabular-nums" style={{ color: ok ? color : "#ada99b" }}>
                {t.meta_pct}%{cume ? " · cume" : ""}
              </div>
              <div className="text-[10px] text-white/50 tabular-nums">+{fmtPctBR(t.commission_pct)}% comissao</div>
            </div>
          </div>
        );
      })}

      {/* O vendedor subindo */}
      <div
        className="absolute z-10"
        style={{ left: `${(ax / W) * 100}%`, top: `${(ay / H) * 100}%`, transform: "translate(-50%, -100%)", transition: "left 900ms ease, top 900ms ease" }}
      >
        <div className="flex flex-col items-center gap-0.5 pb-2">
          <div className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: color, color: "#000" }}>
            {noCume && <Mountain className="h-3 w-3" />}
            {fmtPct(pctMeta)}
          </div>
          <div
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 bg-panel shadow-lg"
            style={{ borderColor: avatarColor || color, boxShadow: `0 0 12px ${color}77` }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-sm font-bold text-white" style={{ background: (avatarColor || color) + "44" }}>
                {avatarInitial}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
