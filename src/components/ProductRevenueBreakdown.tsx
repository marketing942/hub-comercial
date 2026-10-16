import type { ProductBreakdownRow } from "@/lib/data";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import ProgressBar from "@/components/ProgressBar";

export default function ProductRevenueBreakdown({
  rows,
  color,
  excludeIds = [],
}: {
  rows: ProductBreakdownRow[];
  color: string;
  excludeIds?: readonly string[];
}) {
  const filtered = rows.filter((r) => !excludeIds.includes(r.product_line));
  const visible = filtered.filter(
    (r) => r.valor_meta > 0 || r.valor > 0 || r.quantidade_meta > 0 || r.qtd > 0
  );
  const data = visible.length > 0 ? visible : filtered;

  return (
    <div className="panel p-5 h-full">
      <div className="mb-3">
        <div className="text-sm font-semibold">Receita por categoria</div>
        <div className="text-xs text-white/50">Faturado x Meta de cada categoria de produto</div>
      </div>

      {data.length === 0 ? (
        <div className="text-sm text-white/50">Nenhuma linha de produto com meta ou venda neste mes.</div>
      ) : (
        <div className="space-y-3">
          {data.map((r) => {
            const pctValor = r.valor_meta > 0 ? (r.valor / r.valor_meta) * 100 : 0;
            const pctQtd = r.quantidade_meta > 0 ? (r.qtd / r.quantidade_meta) * 100 : 0;
            const pct = r.valor_meta > 0 ? pctValor : pctQtd;
            const hasMeta = r.valor_meta > 0 || r.quantidade_meta > 0;
            const tone = !hasMeta ? COLOR.neutral : pct >= 100 ? COLOR.ok : COLOR.neutral;
            const barTone = !hasMeta ? COLOR.neutral : pct >= 100 ? COLOR.ok : COLOR.gold;
            const falta = Math.max(0, r.valor_meta - r.valor);
            return (
              <div key={r.product_line} className="rounded-xl bg-panel2/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold truncate">{r.label}</div>
                  <div className="text-sm font-bold shrink-0" style={{ color: tone }}>
                    {hasMeta ? fmtPct(pct) : "Sem meta"}
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={pct} color={barTone} height={7} />
                </div>
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
                  <Cell label="Faturado" value={BRL.format(r.valor)} tone={tone} />
                  <Cell label="Meta" value={r.valor_meta > 0 ? BRL.format(r.valor_meta) : "—"} />
                  <Cell
                    label={pct >= 100 && hasMeta ? "Status" : "Faltam"}
                    value={
                      !hasMeta
                        ? "—"
                        : pct >= 100
                        ? "Meta batida"
                        : r.valor_meta > 0
                        ? BRL.format(falta)
                        : "—"
                    }
                    tone={pct >= 100 && hasMeta ? COLOR.ok : undefined}
                  />
                  <Cell
                    label="Unidades"
                    value={
                      r.quantidade_meta > 0
                        ? `${fmtInt.format(r.qtd)} / ${fmtInt.format(r.quantidade_meta)}`
                        : fmtInt.format(r.qtd)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-sm font-semibold mt-0.5 truncate" style={{ color: tone || COLOR.neutral }}>
        {value}
      </div>
    </div>
  );
}
