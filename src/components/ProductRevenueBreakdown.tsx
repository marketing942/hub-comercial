/**
 * "Receita por categoria" — o card que abre nas vendas da categoria.
 *
 * ## O que mudou em 2026-11-23, e o que NÃO mudou
 *
 * O card é o mesmo de sempre: título, % da meta, barra e as quatro células
 * (Faturado / Meta / Faltam / Unidades). Nada foi redesenhado — a identidade
 * já existia e funcionava. O que entrou foi a expansão: clicar na categoria
 * abre a lista das vendas que formaram aquele "Faturado".
 *
 * Isso substituiu um bloco separado de "vendas que entraram para a meta", que
 * repetia a mesma informação num segundo lugar e com outra cara. Uma lista de
 * vendas solta responde "quais vendas houve", que quase ninguém pergunta; a
 * pergunta real nasce olhando uma categoria e querendo ver o que tem dentro.
 * O detalhe pertence ao card, não a um bloco vizinho.
 *
 * ## Por que `<details>` e não estado React
 *
 * Abrir não busca nada — o servidor já mandou as vendas junto. O `<details>`
 * é do HTML: abre e fecha mesmo que o JS não tenha hidratado, e já vem com o
 * comportamento de teclado e de leitor de tela prontos.
 */
import type { ProductBreakdownRow } from "@/lib/data";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import ProgressBar from "@/components/ProgressBar";

/** "2026-11-23" -> "23/11". Sem `new Date()`: a string já está no fuso certo. */
function dia(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

export default function ProductRevenueBreakdown({
  rows,
  excludeIds = [],
  titulo = "Receita por categoria",
  subtitulo = "Faturado x Meta de cada categoria de produto",
  mostrarVendedor = true,
}: {
  rows: ProductBreakdownRow[];
  /** Mantida para os chamadores antigos; o card não usa cor própria. */
  color?: string;
  excludeIds?: readonly string[];
  titulo?: string;
  subtitulo?: string;
  /** No painel do vendedor a coluna é redundante: as vendas são todas dele. */
  mostrarVendedor?: boolean;
}) {
  const filtered = rows.filter((r) => !excludeIds.includes(r.product_line));
  const visible = filtered.filter(
    (r) => r.valor_meta > 0 || r.valor > 0 || r.quantidade_meta > 0 || r.qtd > 0
  );
  const data = visible.length > 0 ? visible : filtered;

  return (
    <div className="panel p-5 h-full">
      <div className="mb-3">
        <div className="text-sm font-semibold">{titulo}</div>
        <div className="text-xs text-white/50">{subtitulo}</div>
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
            const vendas = r.vendas ?? [];

            const corpo = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold truncate flex items-center gap-1.5 min-w-0">
                    {vendas.length > 0 && (
                      <span
                        aria-hidden
                        className="shrink-0 text-[9px] text-white/30 transition-transform group-open:rotate-90"
                      >
                        &#9654;
                      </span>
                    )}
                    <span className="truncate">{r.label}</span>
                  </div>
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
              </>
            );

            // Sem venda para mostrar, o card continua sendo o card de antes —
            // nada de seta nem de cursor de clique prometendo o que não abre.
            if (vendas.length === 0) {
              return (
                <div key={r.product_line} className="rounded-xl bg-panel2/60 p-3">
                  {corpo}
                </div>
              );
            }

            return (
              <details key={r.product_line} className="group rounded-xl bg-panel2/60 p-3">
                <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                  {corpo}
                </summary>

                <div className="mt-3 border-t border-white/10 pt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[9px] uppercase tracking-wider text-white/40">
                        <th scope="col" className="py-1 pr-3 font-normal">Data</th>
                        {mostrarVendedor && (
                          <th scope="col" className="py-1 pr-3 font-normal">Vendedor</th>
                        )}
                        <th scope="col" className="py-1 pr-3 font-normal text-right">Qtd</th>
                        <th scope="col" className="py-1 font-normal text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {vendas.map((v) => (
                        <tr key={v.id} className="border-t border-white/5">
                          <td className="py-1 pr-3 whitespace-nowrap text-white/50">{dia(v.data)}</td>
                          {mostrarVendedor && (
                            <td className="py-1 pr-3 text-white/70 truncate">{v.vendedor}</td>
                          )}
                          <td className="py-1 pr-3 text-right text-white/40">{v.quantidade}</td>
                          <td className="py-1 text-right font-semibold">{BRL.format(v.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-1.5 text-[10px] text-white/30">
                    {vendas.length} venda{vendas.length === 1 ? "" : "s"} nesta categoria
                  </div>
                </div>
              </details>
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
