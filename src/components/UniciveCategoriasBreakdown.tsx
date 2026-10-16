import type { ProductBreakdownRow } from "@/lib/data";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import ProgressBar from "@/components/ProgressBar";

const ITEMS = [
  { id: "matriculas", label: "Matriculas" },
  { id: "bolsas_unicive", label: "Bolsas" },
];

export default function UniciveCategoriasBreakdown({ rows }: { rows: ProductBreakdownRow[] }) {
  const map = new Map(rows.map((r) => [r.product_line, r]));
  const totalQtd = ITEMS.reduce((a, i) => a + (map.get(i.id)?.qtd || 0), 0);
  const totalMetaQtd = ITEMS.reduce((a, i) => a + (map.get(i.id)?.quantidade_meta || 0), 0);
  const totalPct = totalMetaQtd > 0 ? (totalQtd / totalMetaQtd) * 100 : 0;

  return (
    <div className="panel p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            Matriculas x Bolsas
          </div>
          <div className="text-xs text-white/50">Avanco em quantidade e faturamento por categoria</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/50">Total</div>
          <div className="text-base font-bold">
            {fmtInt.format(totalQtd)} / {fmtInt.format(totalMetaQtd)}
          </div>
          <div className="text-[11px]" style={{ color: totalPct >= 100 ? COLOR.ok : COLOR.neutral }}>
            {fmtPct(totalPct)}
          </div>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {ITEMS.map((i) => {
          const r = map.get(i.id);
          const qtd = r?.qtd || 0;
          const meta = r?.quantidade_meta || 0;
          const valor = r?.valor || 0;
          const valorMeta = r?.valor_meta || 0;
          const pctQ = meta > 0 ? (qtd / meta) * 100 : 0;
          const pctV = valorMeta > 0 ? (valor / valorMeta) * 100 : 0;
          const toneQ = meta <= 0 ? COLOR.neutral : pctQ >= 100 ? COLOR.ok : COLOR.neutral;
          const barToneQ = meta <= 0 ? COLOR.neutral : pctQ >= 100 ? COLOR.ok : COLOR.gold;
          const toneV = valorMeta <= 0 ? COLOR.neutral : pctV >= 100 ? COLOR.ok : COLOR.neutral;
          const barToneV = valorMeta <= 0 ? COLOR.neutral : pctV >= 100 ? COLOR.ok : COLOR.gold;
          return (
            <div key={i.id} className="rounded-xl bg-panel2/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">{i.label}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40">
                  Quantidade / Faturamento
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-white/60">
                    <span className="font-semibold" style={{ color: toneQ }}>
                      {fmtInt.format(qtd)}
                    </span>
                    <span className="text-white/40"> / {fmtInt.format(meta)} un.</span>
                  </div>
                  <ProgressBar value={pctQ} color={barToneQ} height={6} />
                  <div className="text-[11px] mt-1" style={{ color: toneQ }}>{fmtPct(pctQ)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/60">
                    <span className="font-semibold" style={{ color: toneV }}>
                      {BRL.format(valor)}
                    </span>
                    <span className="text-white/40"> / {BRL.format(valorMeta)}</span>
                  </div>
                  <ProgressBar value={pctV} color={barToneV} height={6} />
                  <div className="text-[11px] mt-1" style={{ color: toneV }}>{fmtPct(pctV)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-white/40">
        Bolsas tambem contam na meta total de matriculas do vendedor.
      </div>
    </div>
  );
}
