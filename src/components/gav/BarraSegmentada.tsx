/**
 * Barra de progresso SEGMENTADA do GAV (26/11/2026): UMA barra so —
 *   dourado (o degrade do grafico de evolucao do CPPEM) = realizado,
 *   vermelho apagado = o que falta para a meta.
 * Embaixo: "Realizado R$ X" a esquerda e "Falta R$ Y" a direita (ou "Acima +R$",
 * em verde, quando passou; ou "sem meta"). Sem trilho nem sombra. Puro.
 */
import { COLOR } from "@/lib/brand";
import { DOURADO_REALIZADO } from "@/components/DuasBarras";

export const COR_FALTA = "rgba(238,125,115,0.42)";
const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function BarraSegmentada({
  real,
  meta,
  altura = 12,
  rotulos = true,
}: {
  real: number;
  meta: number;
  altura?: number;
  /** Mostra "Realizado ... Falta" embaixo da barra. */
  rotulos?: boolean;
}) {
  const tm = meta > 0;
  // Passou da meta (ou sem meta): a barra e toda dourada.
  const fracReal = tm ? Math.max(0, Math.min(1, real / meta)) : real > 0 ? 1 : 0;
  const falta = tm ? meta - real : 0;
  return (
    <div>
      <div className="barra-seg flex w-full overflow-hidden rounded-[4px]" style={{ ["--h" as string]: `${altura}px` }}>
        {fracReal > 0 && <div className="h-full" style={{ width: `${fracReal * 100}%`, background: DOURADO_REALIZADO }} />}
        {tm && fracReal < 1 && <div className="h-full flex-1" style={{ background: COR_FALTA }} />}
        {!tm && real <= 0 && <div className="h-full flex-1 bg-white/[0.06]" />}
      </div>
      {rotulos && (
        <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px] leading-none tabular-nums">
          <span className="truncate text-white/55">
            Realizado <b className="font-semibold text-white/85">{BRL0.format(real)}</b>
          </span>
          <span className="shrink-0" style={{ color: !tm ? "rgba(255,255,255,0.4)" : falta > 0 ? COLOR.danger : COLOR.ok }}>
            {!tm ? "sem meta" : falta > 0 ? `Falta ${BRL0.format(falta)}` : `Acima +${BRL0.format(-falta)}`}
          </span>
        </div>
      )}
    </div>
  );
}

/** Legenda da barra segmentada. */
export function LegendaSegmentada() {
  return (
    <span className="flex items-center gap-3 whitespace-nowrap text-[10px] uppercase tracking-wider text-white/40 max-sm:hidden">
      <span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: DOURADO_REALIZADO }} />Realizado</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: COR_FALTA }} />Falta p/ meta</span>
    </span>
  );
}
