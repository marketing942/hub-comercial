/**
 * "Receita por categoria" do dashboard da BU, com as categorias do PROPRIO Conta
 * Azul e a meta de cada uma (Configuracoes > Metas). Grade compacta, 3 linhas de
 * receita lado a lado (2 no tablet, 1 no celular), cada uma com as duas barras
 * (realizado x meta) do padrao do GAV.
 */
import type { CategoriaCA } from "@/lib/ca/metasLinhaTipos";
import { fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import DuasBarras, { LegendaBarras } from "@/components/DuasBarras";

export default function ReceitaCategoriasCA({ rows }: { rows: CategoriaCA[] }) {
  return (
    <div className="panel p-4 h-full">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Receita por categoria</div>
        <LegendaBarras />
      </div>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const temMeta = r.meta_valor > 0;
          const pct = temMeta ? (r.valor / r.meta_valor) * 100 : 0;
          const cor = !temMeta ? COLOR.gold : pct >= 100 ? COLOR.ok : COLOR.gold;
          return (
            <div key={r.id} className="min-w-0 rounded-xl bg-panel2/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold truncate">{r.nome}</div>
                <div className="text-[13px] font-bold shrink-0 tabular-nums" style={{ color: temMeta ? (pct >= 100 ? COLOR.ok : COLOR.neutral) : COLOR.mute }}>
                  {temMeta ? fmtPct(pct) : "sem meta"}
                </div>
              </div>
              <div className="mt-1.5">
                <DuasBarras real={r.valor} meta={r.meta_valor} cor={cor} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
