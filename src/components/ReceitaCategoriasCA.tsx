/**
 * "Receita por categoria" do dashboard da BU, com as categorias do PROPRIO Conta
 * Azul e a meta de cada uma (Configuracoes > Metas por linha). Mesmo desenho do
 * `ProductRevenueBreakdown`: titulo, % da meta, barra e as 4 celulas.
 */
import type { CategoriaCA } from "@/lib/ca/metasLinhaTipos";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import ProgressBar from "@/components/ProgressBar";

function Celula({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-sm font-semibold mt-0.5 truncate" style={{ color: tone || COLOR.neutral }}>
        {value}
      </div>
    </div>
  );
}

export default function ReceitaCategoriasCA({ rows }: { rows: CategoriaCA[] }) {
  return (
    <div className="panel p-5 h-full">
      <div className="mb-3">
        <div className="text-sm font-semibold">Receita por categoria</div>
        <div className="text-xs text-white/50">Categorias do Conta Azul: faturado x meta de cada linha de receita</div>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const hasMeta = r.meta_valor > 0 || r.meta_qtd > 0;
          const pct = r.meta_valor > 0 ? (r.valor / r.meta_valor) * 100 : r.meta_qtd > 0 ? (r.qtd / r.meta_qtd) * 100 : 0;
          const batida = hasMeta && pct >= 100;
          const tone = batida ? COLOR.ok : COLOR.neutral;
          return (
            <div key={r.id} className="rounded-xl bg-panel2/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold truncate">{r.nome}</div>
                <div className="text-sm font-bold shrink-0" style={{ color: tone }}>
                  {hasMeta ? fmtPct(pct) : "Sem meta"}
                </div>
              </div>
              <div className="mt-2">
                <ProgressBar value={pct} color={batida ? COLOR.ok : COLOR.gold} height={7} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
                <Celula label="Faturado" value={BRL.format(r.valor)} tone={tone} />
                <Celula label="Meta" value={r.meta_valor > 0 ? BRL.format(r.meta_valor) : "—"} />
                <Celula
                  label={batida ? "Status" : "Faltam"}
                  value={!hasMeta ? "—" : batida ? "Meta batida" : r.meta_valor > 0 ? BRL.format(Math.max(0, r.meta_valor - r.valor)) : "—"}
                  tone={batida ? COLOR.ok : undefined}
                />
                <Celula
                  label="Unidades"
                  value={r.meta_qtd > 0 ? `${fmtInt.format(r.qtd)} / ${fmtInt.format(r.meta_qtd)}` : fmtInt.format(r.qtd)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
