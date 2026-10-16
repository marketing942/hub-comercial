import type { LigacaoRow } from "@/lib/data";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { LIGACAO_STATUSES, ligacaoLabel, ligacaoColor } from "@/lib/products";
import ProgressBar from "@/components/ProgressBar";

export default function LigacaoBreakdown({
  rows,
  title = "Retorno do Onvox (ligacoes)",
  hint,
}: {
  rows: LigacaoRow[];
  title?: string;
  hint?: React.ReactNode;
}) {
  const totalCount = rows.reduce((a, b) => a + b.count, 0);
  const totalValor = rows.reduce((a, b) => a + b.valor, 0);
  // garante ordem fixa
  const ordered = LIGACAO_STATUSES.map(
    (s) => rows.find((r) => r.status === s.id) || { status: s.id, count: 0, valor: 0 }
  );
  const naoFoiLigacao = ordered.find((r) => r.status === "sem_ligacao")?.count || 0;
  const foiLigacao = totalCount - naoFoiLigacao;
  const pctLigacao = totalCount > 0 ? (foiLigacao / totalCount) * 100 : 0;

  return (
    <div className="card-lg">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            {title}
          </div>
          <div className="text-xs text-white/50">
            {hint || "Origem das vendas lancadas pelos vendedores no mes"}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="text-white/60">
            <b className="text-white">{fmtInt.format(totalCount)}</b> venda
            {totalCount === 1 ? "" : "s"} - <b className="text-white">{BRL.format(totalValor)}</b>
          </div>
          <div className="text-accent">
            {fmtPct(pctLigacao)} vieram (direto ou indireto) de ligacao
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ordered.map((r) => {
          const def = LIGACAO_STATUSES.find((x) => x.id === r.status)!;
          const pct = totalCount > 0 ? (r.count / totalCount) * 100 : 0;
          const isNada = r.status === "sem_ligacao";
          return (
            <div key={r.status} className="rounded-xl bg-panel2 p-4 relative overflow-hidden">
              <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.14] blur-2xl"
                style={{ background: "#c9ae7a" }}
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="chip" style={{ background: def.color + "22", color: def.color }}>
                    
                    {def.short}
                  </div>
                  <div className="text-[11px] text-white/40">{fmtPct(pct)}</div>
                </div>
                <div className="text-3xl font-bold" style={{ color: def.color }}>
                  {fmtInt.format(r.count)}
                </div>
                <div className="text-[11px] text-white/50">
                  {BRL.format(r.valor)} faturado
                </div>
                <div className="mt-2">
                  <ProgressBar value={pct} color={def.color} height={6} />
                </div>
                <div className="text-[10px] text-white/40 mt-2 leading-tight">{def.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
