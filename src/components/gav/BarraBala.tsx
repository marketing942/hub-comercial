/**
 * Barras do GAV: duas barras na mesma escala (META em cima, REALIZADO embaixo),
 * com o numero escrito em cada uma.
 *
 * TESTE 26/11/2026 (cores invertidas, a pedido do time): META = dourado do
 * grafico de evolucao do CPPEM e REALIZADO = cinza claro puxado para o branco.
 * Para desfazer, troque `COR_META_GAV` e `COR_REAL_GAV` de volta.
 */
import DuasBarras, { DOURADO_REALIZADO, LegendaBarras } from "@/components/DuasBarras";

export const COR_META_GAV = DOURADO_REALIZADO;
export const COR_REAL_GAV = "rgba(236,233,225,0.5)";

export default function BarraBala({
  real,
  meta,
  altura = 10,
  falta,
}: {
  real: number;
  meta: number;
  /** Mantido por compatibilidade (o tracinho de ritmo saiu com a barra de bala). */
  idealPct?: number;
  altura?: number;
  /** Mostra uma 3a barra com quanto falta para a meta (ou quanto passou). */
  falta?: boolean;
}) {
  const f = meta - real;
  const terceira =
    falta && meta > 0
      ? f > 0
        ? { valor: f, cor: "rgba(238,125,115,0.55)", texto: `Falta ${Math.round(f).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` }
        : { valor: -f, cor: "rgba(95,208,143,0.5)", texto: `Acima +${Math.round(-f).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` }
      : undefined;
  return (
    <DuasBarras
      real={real}
      meta={meta}
      cor={COR_REAL_GAV}
      corMeta={COR_META_GAV}
      terceira={terceira}
      altura={Math.max(15, altura + 4)}
    />
  );
}

export function LegendaBala(_: { comRitmo?: boolean }) {
  return (
    <span className="max-sm:hidden">
      <LegendaBarras cor={COR_REAL_GAV} corMeta={COR_META_GAV} />
    </span>
  );
}
