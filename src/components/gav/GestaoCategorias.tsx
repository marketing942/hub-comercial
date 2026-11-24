import { COLOR } from "@/lib/brand";
import { BRL, fmtPct } from "@/lib/calc";
import { BU_GESTAO_ROTULO, BUS_GESTAO, type GestaoMes } from "@/lib/gestaoAVistaTipos";
import ProgressBar from "@/components/ProgressBar";


/**
 * Receita por categoria — TODAS as linhas de receita do Conta Azul no mes, as
 * dos vendedores e as que existem so no grupo (mensalidade, repasse...),
 * agrupadas por BU, com o subtotal de cada uma. As categorias sao as do proprio
 * Conta Azul. A barra e a fatia do faturamento total.
 */
export default function GestaoCategorias({ dados }: { dados: GestaoMes }) {
  const { categorias, total } = dados;
  const grupos = BUS_GESTAO.map((bu) => {
    const linhas = categorias.filter((c) => c.bu === bu).sort((a, b) => b.valor - a.valor);
    return { bu, linhas, subtotal: linhas.reduce((s, c) => s + c.valor, 0) };
  }).filter((g) => g.linhas.length > 0);

  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="eyebrow-label">Receita por categoria</div>
          <div className="mt-1 text-xs text-white/45">
            Todas as linhas de receita do Conta Azul no mes — vendedores, direto e diretoria somados.
          </div>
        </div>
        <div className="text-right">
          <div className="kpi-label">Total da empresa</div>
          <div className="font-display text-xl font-bold tabular-nums">{BRL.format(total)}</div>
        </div>
      </div>

      {grupos.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/50">Nenhuma receita neste mes.</p>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.bu}>
              <div className="flex items-baseline justify-between border-b border-[var(--hair)] pb-1.5">
                <span className="font-ui text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
                  {BU_GESTAO_ROTULO[g.bu]}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {BRL.format(g.subtotal)}
                  <span className="ml-2 text-xs font-normal text-white/45">
                    {total > 0 ? fmtPct((g.subtotal / total) * 100) : "—"}
                  </span>
                </span>
              </div>
              <ul>
                {g.linhas.map((c) => {
                  const pct = total > 0 ? (c.valor / total) * 100 : 0;
                  return (
                    <li key={c.chave} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                      <span className="truncate text-sm text-white/85">{c.rotulo}</span>
                      <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                        <ProgressBar value={pct} color={COLOR.gold} height={6} />
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums">
                        {c.metaValor > 0 ? (
                          <span className="mr-2 text-xs font-normal text-white/40">
                            meta {BRL.format(c.metaValor)} · {fmtPct((c.valor / c.metaValor) * 100)}
                          </span>
                        ) : null}
                        {BRL.format(c.valor)}
                        <span className="ml-2 inline-block w-12 text-right text-xs font-normal text-white/45">{fmtPct(pct)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
