/**
 * Meta longa (ex.: "Meta de matriculas 2027" do Colegio), no topo do painel da BU.
 * Desde 26/11/2026 no MESMO padrao das faixas de indicadores (`Indicador`):
 * titulo + periodo numa linha e tres celulas — total de alunos, novas no
 * periodo e prazo. Numero principal = realizado (unico com cor); o resto em
 * linhas "rotulo ... valor" sem cor. Sem barra de progresso.
 */
import type { LongTermProgress } from "@/lib/longTerm";
import { fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import Indicador, { type Linha } from "@/components/Indicador";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function LongTermGoalCard({
  progress,
}: {
  progress: LongTermProgress;
  /** Mantido por compatibilidade (o card nao usa mais cor de destaque). */
  accent?: string;
}) {
  const g = progress.goal;
  const n = (v: number) => fmtInt.format(Math.round(v));
  const period = `${MONTHS_SHORT[g.start_month - 1]}/${g.start_year} – ${MONTHS_SHORT[g.end_month - 1]}/${g.end_year}`;
  const batida = progress.hasMeta && progress.realizado >= progress.meta;
  // Verde = meta batida ou no ritmo; vermelho = atras; branco = sem meta.
  const tom = !progress.hasMeta ? COLOR.neutral : batida || progress.paceIsAhead ? COLOR.ok : COLOR.danger;
  const sinal = progress.paceNovas >= 0 ? "+" : "−";

  const alunos: Linha[] = progress.hasMeta
    ? [
        ["Meta", `${n(progress.meta)} · ${fmtPct(progress.pctMeta)}`],
        ["Faltam", batida ? "Batida" : n(progress.restam)],
        ["Projecao final", `${n(progress.projecaoTotal)} · ${fmtPct(progress.pctProjecao)}`],
      ]
    : [["Meta", "Sem meta"]];
  const novas: Linha[] = [
    ["Base (antes do inicio)", n(progress.baseCount)],
    ...(progress.hasMeta
      ? ([
          ["Esperado ate hoje", n(progress.expectedNovasAteHoje)],
          ["Pace", `${sinal}${n(Math.abs(progress.paceNovas))}`],
        ] as Linha[])
      : []),
  ];
  const pctPeriodo = progress.bDaysTotal > 0 ? (progress.bDaysElapsed / progress.bDaysTotal) * 100 : 0;
  const prazo: Linha[] = [
    ["Periodo", period],
    ["Ja passou", `${n(progress.bDaysElapsed)} de ${n(progress.bDaysTotal)} · ${fmtPct(pctPeriodo)}`],
  ];

  const status = progress.periodEnded ? "Encerrada" : !progress.periodStarted ? `Comeca em ${MONTHS_SHORT[g.start_month - 1]}/${g.start_year}` : null;

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="eyebrow-label truncate">{g.label}</div>
        <div className="shrink-0 text-[11px] text-white/40">
          {period}
          {status && <span className="ml-2 font-semibold text-white/60">· {status}</span>}
        </div>
      </div>
      <div className="-ml-px grid grid-cols-1 sm:grid-cols-3">
        <Indicador label="Total de alunos" value={n(progress.realizado)} tone={tom} linhas={alunos} />
        <Indicador label="Novas no periodo" value={`+${n(progress.novasNoPeriodo)}`} tone={tom} linhas={novas} />
        <Indicador
          label="Prazo"
          value={progress.periodEnded ? "Encerrada" : `${n(progress.bDaysLeft)} dias uteis`}
          tone={COLOR.neutral}
          linhas={prazo}
        />
      </div>
    </section>
  );
}
