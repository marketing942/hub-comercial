import type { ProductBreakdownRow } from "@/lib/data";
import { fmtInt, fmtPct } from "@/lib/calc";
import { COLEGIO_MATRICULAS_IDS, productLabel } from "@/lib/products";
import { COLOR } from "@/lib/brand";
import ProgressBar from "@/components/ProgressBar";

export default function ColegioTurmasBreakdown({ rows }: { rows: ProductBreakdownRow[] }) {
  const map = new Map(rows.map((r) => [r.product_line, r]));
  const turmas = COLEGIO_MATRICULAS_IDS.map((id) => ({
    id,
    label: productLabel(id),
    row: map.get(id),
  }));
  const totalReal = turmas.reduce((a, t) => a + (t.row?.qtd || 0), 0);
  const totalMeta = turmas.reduce((a, t) => a + (t.row?.quantidade_meta || 0), 0);
  const totalPct = totalMeta > 0 ? (totalReal / totalMeta) * 100 : 0;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            Alunos por turma do colegio
          </div>
          <div className="text-xs text-white/50">Meta x Realizado em quantidade de alunos por serie</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/50">Total</div>
          <div className="text-lg font-bold">
            {fmtInt.format(totalReal)} / {fmtInt.format(totalMeta)}
          </div>
          <div className="text-xs" style={{ color: totalPct >= 100 ? COLOR.ok : COLOR.neutral }}>
            {fmtPct(totalPct)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {turmas.map((t) => {
          const qtd = t.row?.qtd || 0;
          const meta = t.row?.quantidade_meta || 0;
          const pct = meta > 0 ? (qtd / meta) * 100 : 0;
          const falta = Math.max(0, meta - qtd);
          const tone = meta <= 0 ? COLOR.neutral : pct >= 100 ? COLOR.ok : COLOR.neutral;
          const barTone = meta <= 0 ? COLOR.neutral : pct >= 100 ? COLOR.ok : COLOR.gold;
          return (
            <div key={t.id} className="rounded-xl bg-panel2 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-white/70 truncate">{t.label}</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: tone }}>
                  {fmtInt.format(qtd)}
                </span>
                <span className="text-xs text-white/40">/ {fmtInt.format(meta)}</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={pct} color={barTone} height={6} />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className="text-white/50">
                  {pct >= 100 ? "Bateu" : `Faltam ${fmtInt.format(falta)}`}
                </span>
                <span style={{ color: tone }}>{fmtPct(pct)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
