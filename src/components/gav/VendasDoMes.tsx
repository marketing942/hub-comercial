/**
 * As vendas do mês escolhido, por categoria, cada uma abrindo nas vendas.
 *
 * Mesmo gesto do card "Receita por categoria" do painel — categoria é a linha,
 * a venda é o detalhe que se abre —, mas sem meta: aqui o assunto é um mês
 * qualquer do ano, e meta por categoria é coisa do mês corrente.
 *
 * Server component: `<details>` é HTML puro, então não há estado a manter nem
 * JavaScript a enviar para o navegador.
 */
import { BU_COLOR, BU_LABEL } from "@/lib/brand";
import { MES_NOME } from "@/lib/vendasMesTipos";
import type { CategoriaDetalhe } from "@/lib/vendasMesTipos";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** "2026-11-23" → "23/11". Sem `new Date()`: a string já está no fuso certo. */
function dia(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

export default function VendasDoMes({
  categorias,
  mes,
  year,
}: {
  categorias: CategoriaDetalhe[];
  mes: number;
  year: number;
}) {
  const total = categorias.reduce((s, c) => s + c.valor, 0);
  const vendas = categorias.reduce((s, c) => s + c.vendas.length, 0);

  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            Vendas de {MES_NOME[mes - 1]} de {year}
          </div>
          <div className="text-xs text-white/50">
            Por categoria. Clique numa linha para ver as vendas dela.
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="text-sm font-bold tabular-nums">{BRL(total)}</div>
          <div className="text-[11px] text-white/40">
            {vendas} venda{vendas === 1 ? "" : "s"} em {categorias.length} categoria
            {categorias.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {categorias.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">
          Nenhuma venda em {MES_NOME[mes - 1]} de {year}.
        </p>
      ) : (
        <div className="space-y-2">
          {categorias.map((c) => (
            <details key={c.chave} className="group rounded-xl bg-panel2/60 p-3">
              <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="shrink-0 text-[9px] text-white/30 transition-transform group-open:rotate-90"
                >
                  &#9654;
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.rotulo}</span>
                <span
                  className="hidden shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/35 sm:inline-flex"
                >
                  <i className="inline-block h-2 w-2 rounded-sm" style={{ background: BU_COLOR[c.bu] }} />
                  {BU_LABEL[c.bu]}
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-white/40">
                  {c.vendas.length}x
                </span>
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {BRL(c.valor)}
                </span>
              </summary>

              <div className="mt-3 overflow-x-auto border-t border-white/10 pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-wider text-white/40">
                      <th scope="col" className="py-1 pr-3 font-normal">Data</th>
                      <th scope="col" className="py-1 pr-3 font-normal">Vendedor</th>
                      <th scope="col" className="py-1 pr-3 text-right font-normal">Qtd</th>
                      <th scope="col" className="py-1 text-right font-normal">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {c.vendas.map((v) => (
                      <tr key={v.id} className="border-t border-white/5">
                        <td className="whitespace-nowrap py-1 pr-3 text-white/50">{dia(v.data)}</td>
                        <td className="truncate py-1 pr-3 text-white/70">{v.vendedor}</td>
                        <td className="py-1 pr-3 text-right text-white/40">{v.quantidade}</td>
                        <td className="py-1 text-right font-semibold">{BRL(v.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
