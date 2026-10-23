"use client";
import { fmtPct } from "@/lib/calc";
import type { CommissionRules } from "@/lib/commission";
import { Zap } from "lucide-react";

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
}) {
  // Escala vai de 0 ate o maior tier (ou 100 se so tiver tiers pequenos).
  const maxTier = rules.tiers.reduce((a, t) => Math.max(a, t.meta_pct), 100);
  const scale = Math.max(maxTier, pctMeta, 100);
  const barPct = Math.min(100, (pctMeta / scale) * 100);

  return (
    <div className="card-lg flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          Sua jornada ate o proximo checkpoint
        </div>
        <div className="text-xs font-semibold" style={{ color }}>
          {fmtPct(pctMeta)}
        </div>
      </div>

      {/* ==== Trilha com avatar do vendedor andando ==== */}
      <div className="relative px-2" style={{ paddingTop: 66, paddingBottom: 34 }}>
        {/* trilha */}
        <div className="relative w-full h-2.5 rounded-full bg-border/60 overflow-visible">
          <div
            className="h-full rounded-full"
            style={{
              width: `${barPct}%`,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              boxShadow: `0 0 12px ${color}55`,
              transition: "width 900ms cubic-bezier(.4,1.6,.5,1)",
            }}
          />

          {/* Checkpoints (bolinhas sobre a barra, labels embaixo) */}
          {rules.tiers.map((t) => {
            const pos = Math.min(100, (t.meta_pct / scale) * 100);
            const reached = pctMeta >= t.meta_pct;
            return (
              <div
                key={t.meta_pct}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${pos}%` }}
              >
                <div
                  className="rounded-full border-2 grid place-items-center"
                  style={{
                    width: 16,
                    height: 16,
                    background: reached ? color : "#0b1220",
                    borderColor: reached ? color : "#334155",
                    boxShadow: reached ? `0 0 10px ${color}` : undefined,
                    transition: "background 400ms ease, box-shadow 400ms ease",
                  }}
                >
                  {reached && <Zap className="w-2 h-2 text-black" />}
                </div>
                {/* label abaixo */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 mt-2 text-center whitespace-nowrap"
                  style={{ top: 16 }}
                >
                  <div className="text-[10px] font-semibold" style={{ color: reached ? color : "#ada99b" }}>
                    {t.meta_pct}%
                  </div>
                  <div className="text-[9px] text-white/40 leading-tight">
                    +{t.commission_pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                  </div>
                </div>
              </div>
            );
          })}

          {/* Avatar do vendedor — anda com o pct */}
          <div
            className="absolute -translate-x-1/2"
            style={{
              left: `${barPct}%`,
              bottom: "100%",
              marginBottom: 6,
              transition: "left 900ms cubic-bezier(.4,1.6,.5,1)",
              zIndex: 10,
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: color, color: "#000" }}
              >
                {fmtPct(pctMeta)}
              </div>
              <Avatar
                url={avatarUrl}
                initial={avatarInitial}
                color={avatarColor || color}
                size={44}
              />
              {/* seta apontando pra barra */}
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: `7px solid ${color}`,
                  filter: `drop-shadow(0 0 4px ${color}88)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({
  url,
  initial,
  color,
  size,
}: {
  url?: string | null;
  initial: string;
  color: string;
  size: number;
}) {
  return (
    <div
      className="rounded-full border-2 grid place-items-center overflow-hidden shadow-lg bg-panel"
      style={{
        width: size,
        height: size,
        borderColor: color,
        boxShadow: `0 0 12px ${color}77`,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full grid place-items-center text-sm font-bold text-white"
          style={{ background: color + "44" }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
