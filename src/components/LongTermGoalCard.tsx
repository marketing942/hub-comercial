import type { LongTermProgress } from "@/lib/longTerm";
import { fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import ProgressBar from "@/components/ProgressBar";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Target } from "lucide-react";

const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function LongTermGoalCard({
  progress,
  accent = "#c9ae7a",
}: {
  progress: LongTermProgress;
  accent?: string;
}) {
  const g = progress.goal;
  const pctTone =
    !progress.hasMeta
      ? COLOR.mute
      : progress.pctMeta >= 100
      ? COLOR.ok
      : progress.pctMeta >= 66
      ? accent
      : COLOR.danger;
  const paceColor = !progress.hasMeta
    ? COLOR.mute
    : progress.paceIsAhead
    ? COLOR.ok
    : COLOR.danger;
  const projColor = !progress.hasMeta
    ? COLOR.mute
    : progress.pctProjecao >= 100
    ? COLOR.ok
    : COLOR.danger;
  const Arrow = progress.paceIsAhead ? ArrowUpRight : ArrowDownRight;
  const period = `${MONTHS_SHORT[g.start_month - 1]}/${g.start_year} - ${MONTHS_SHORT[g.end_month - 1]}/${g.end_year}`;

  const paceAbs = fmtInt.format(Math.round(Math.abs(progress.paceNovas)));
  const proj = fmtInt.format(Math.round(progress.projecaoTotal));

  return (
    <section
      className="card-lg relative overflow-hidden"
      style={{ borderColor: accent + "55" }}
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-[0.14] pointer-events-none"
        style={{ background: "#c9ae7a" }}
      />
      <div className="relative flex flex-col xl:flex-row xl:items-center gap-4">
        {/* Coluna 1: label + numero grande */}
        <div className="xl:flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
            <span>{g.label}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{period}</span>
            {progress.periodEnded && (
              <span className="chip" style={{ background: "#ada99b22", color: "#ada99b" }}>
                Encerrada
              </span>
            )}
            {!progress.periodStarted && (
              <span className="chip" style={{ background: accent + "22", color: accent }}>
                Comeca em {MONTHS_SHORT[g.start_month - 1]}/{g.start_year}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-4xl xl:text-5xl font-extrabold leading-none" style={{ color: pctTone }}>
              {fmtInt.format(progress.realizado)}
            </span>
            <span className="text-2xl xl:text-3xl font-bold text-white/40">/</span>
            <span className="text-2xl xl:text-3xl font-bold text-white/50">
              {fmtInt.format(progress.meta)}
            </span>
            <span className="text-sm text-white/50 ml-1">alunos</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={progress.pctMeta} color={pctTone} height={10} />
            <div className="text-[11px] mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span style={{ color: pctTone }} className="font-semibold">
                {fmtPct(progress.pctMeta)} da meta
              </span>
              <span className="text-white/50">
                Base: <b className="text-white/80">{fmtInt.format(progress.baseCount)}</b>
              </span>
              <span className="text-white/50">
                Novas: <b className="text-white/80">+{fmtInt.format(progress.novasNoPeriodo)}</b>
              </span>
              <span className="text-white/50">
                Faltam: <b className="text-white/80">{fmtInt.format(progress.restam)}</b>
              </span>
            </div>
          </div>
        </div>

        {/* Coluna 2: pace + projecao */}
        <div className="grid grid-cols-2 gap-2 xl:w-[340px]">
          <div className="rounded-xl bg-panel2 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
              <Target className="w-3 h-3" /> Pace (novas)
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold inline-flex items-center gap-1" style={{ color: paceColor }}>
                {progress.hasMeta ? (
                  <>
                    <Arrow className="w-4 h-4" />
                    {progress.paceIsAhead ? "+" : "-"}{paceAbs}
                  </>
                ) : "—"}
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              esperado: {fmtInt.format(Math.round(progress.expectedNovasAteHoje))} · real: {fmtInt.format(progress.novasNoPeriodo)}
            </div>
          </div>

          <div className="rounded-xl bg-panel2 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
              <TrendingUp className="w-3 h-3" /> Projecao final
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold" style={{ color: projColor }}>
                {progress.hasMeta ? proj : "—"}
              </span>
              {progress.hasMeta && (
                <span className="text-white/40 text-sm"> / {fmtInt.format(progress.meta)}</span>
              )}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              {progress.hasMeta ? `${fmtPct(progress.pctProjecao)} da meta no fim` : "sem meta"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
