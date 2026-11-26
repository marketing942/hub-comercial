/**
 * Duas barras de grafico na MESMA escala: META em cima (cinza claro fixo) e
 * REALIZADO embaixo, com o numero escrito em cima de cada uma. SEM trilho de fundo
 * (26/11/2026: o trilho parecia uma segunda barra por tras). Padrao dos cards
 * de receita (GAV: BU, origem, linhas; dashboards das BUs: receita por categoria).
 */
import { COLOR } from "@/lib/brand";

/** Cor da barra da META — fixa, para nunca confundir com a do realizado. */
export const COR_META = "rgba(232,228,217,0.34)";

/**
 * Dourado do REALIZADO: o mesmo degrade das barras do grafico de evolucao
 * diaria do CPPEM (#c9ae7a forte em cima, apagando embaixo).
 */
export const DOURADO_REALIZADO = "linear-gradient(180deg, rgba(201,174,122,0.95) 0%, rgba(201,174,122,0.5) 100%)";

const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function DuasBarras({
  real,
  meta,
  cor,
  corMeta = COR_META,
  terceira,
  fmt = (v) => BRL0.format(v),
  altura = 18,
}: {
  real: number;
  meta: number;
  cor: string;
  /** Cor da barra da META (padrao: cinza claro). */
  corMeta?: string;
  /** Barra extra embaixo (ex.: "Falta" no Por BU do GAV), na mesma escala. */
  terceira?: { valor: number; cor: string; texto: string };
  fmt?: (v: number) => string;
  /** Altura de cada barra em px. */
  altura?: number;
}) {
  const max = Math.max(real, meta, 1);
  const barra = (v: number, fundo: string, texto: string) => (
    <div
      className="barra-dupla relative w-full overflow-hidden rounded-[5px]"
      style={{ ["--h" as string]: `${altura}px` }}
    >
      <div className="h-full rounded-[5px]" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: fundo }} />
      <span style={{ fontSize: altura >= 22 ? 12 : 11 }} className="absolute inset-y-0 left-2 flex items-center font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
        {texto}
      </span>
    </div>
  );
  return (
    <div className="space-y-1">
      {barra(meta, corMeta, meta > 0 ? fmt(meta) : "sem meta")}
      {barra(real, cor, fmt(real))}
      {terceira && barra(terceira.valor, terceira.cor, terceira.texto)}
    </div>
  );
}

/** Legenda unica das duas barras, para o cabecalho de cada bloco. */
export function LegendaBarras({ cor = COLOR.gold, corMeta = COR_META }: { cor?: string; corMeta?: string }) {
  return (
    <span className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-white/40">
      <span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: corMeta }} />Meta</span>
      <span className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: cor }} />Realizado</span>
    </span>
  );
}
