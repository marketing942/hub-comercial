/**
 * A faixa de comparação do GAV: manual × Conta Azul, no total e por vendedor.
 *
 * É esta faixa que faz o GAV valer. O dashboard de baixo mostra o mês como ele
 * ficaria depois do cutover; sem a comparação, conferir exigiria abrir duas abas
 * e cruzar número a número de cabeça.
 *
 * ## Cor
 *
 * A diferença é um NÚMERO DE RESULTADO, então usa a paleta de `COLOR`
 * (`src/lib/brand.ts`) e nunca a cor da BU — identidade não diz se o número é
 * bom. Diferença dentro da tolerância é `ok`; fora dela, `danger`; sem manual
 * para comparar, `mute`.
 *
 * E a cor não carrega o recado sozinha: toda linha traz o valor com sinal e o
 * percentual escritos, porque a diferença é o dado, não a decoração.
 */
import { COLOR } from "@/lib/brand";
import type { Comparacao, LinhaComparacao } from "@/lib/gav";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const pct = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : "−"}${(Math.abs(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

/**
 * Fora deste limite a divergência deixa de ser arredondamento e vira problema.
 * 3% é folga para diferença de dia de lançamento; acima disso, alguma venda não
 * está casando.
 */
const TOLERANCIA = 0.03;

function tom(l: LinhaComparacao): string {
  if (l.variacao == null) return COLOR.mute;
  return Math.abs(l.variacao) <= TOLERANCIA ? COLOR.ok : COLOR.danger;
}

const BU_NOME: Record<string, string> = {
  cppem: "CPPEM",
  unicive: "UNICIVE",
  colegio_cppem: "Colégio",
};

export default function GavComparativo({ dados }: { dados: Comparacao }) {
  const { total, porVendedor, porBu, semColunaOrigem } = dados;

  return (
    <section className="panel mb-4 overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow-label">GAV · conferência do faturamento</h2>
        <span className="font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
          manual × Conta Azul · {String(dados.month).padStart(2, "0")}/{dados.year}
        </span>
      </div>

      {semColunaOrigem ? (
        <p
          className="mb-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: `${COLOR.warning}1a`, color: COLOR.warning }}
        >
          <strong>O Conta Azul não trouxe nenhuma venda neste mês.</strong> Confira, nesta ordem: a
          migração <code>supabase/ca-01-origem.sql</code> rodou? O sync do Conta Azul já gravou
          linhas com <code>origem = &apos;conta_azul&apos;</code>? Enquanto uma das duas faltar, o
          painel abaixo fica vazio — e isso é o esperado, não defeito da tela.
        </p>
      ) : null}

      {/* O total, grande. É a primeira pergunta: fechou? */}
      <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="kpi-label text-white/40">Manual</p>
          <p className="big-num tabular-nums">{brl(total.manual)}</p>
        </div>
        <div>
          <p className="kpi-label text-white/40">Conta Azul</p>
          <p className="big-num tabular-nums">{brl(total.contaAzul)}</p>
        </div>
        <div>
          <p className="kpi-label text-white/40">Diferença</p>
          <p className="big-num tabular-nums" style={{ color: tom(total) }}>
            {total.diferenca >= 0 ? "+" : "−"}
            {brl(Math.abs(total.diferenca))}
            <span className="ml-2 text-base">{pct(total.variacao)}</span>
          </p>
        </div>
      </div>

      {/*
        Por vendedor, e não só o total: o total fecha por compensação — um
        vendedor a mais, outro a menos — e esconde justamente o número
        individual, que é sobre o qual caem meta e comissão.
      */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            Faturamento por vendedor em cada origem, com a diferença entre elas.
          </caption>
          <thead>
            <tr className="font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
              <th scope="col" className="pb-2 text-left font-semibold">Vendedor</th>
              <th scope="col" className="pb-2 text-left font-semibold">BU</th>
              <th scope="col" className="pb-2 text-right font-semibold">Manual</th>
              <th scope="col" className="pb-2 text-right font-semibold">Conta Azul</th>
              <th scope="col" className="pb-2 text-right font-semibold">Diferença</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {porBu.map((l) => (
              <tr key={`bu-${l.chave}`} className="border-t border-[var(--hair)]">
                <th scope="row" className="py-1.5 text-left font-ui text-xs uppercase tracking-[.1em] text-white/50">
                  {BU_NOME[l.chave] ?? l.chave}
                </th>
                <td className="py-1.5 text-white/30">—</td>
                <td className="py-1.5 text-right text-white/60">{brl(l.manual)}</td>
                <td className="py-1.5 text-right text-white/60">{brl(l.contaAzul)}</td>
                <td className="py-1.5 text-right font-semibold" style={{ color: tom(l) }}>
                  {pct(l.variacao)}
                </td>
              </tr>
            ))}
            {porVendedor.map((l) => (
              <tr key={l.chave} className="border-t border-[var(--hair)]/50">
                <td className="py-1.5">{l.rotulo}</td>
                <td className="py-1.5 text-white/40">{BU_NOME[l.bu ?? ""] ?? "—"}</td>
                <td className="py-1.5 text-right">{brl(l.manual)}</td>
                <td className="py-1.5 text-right">{brl(l.contaAzul)}</td>
                <td className="py-1.5 text-right font-semibold" style={{ color: tom(l) }}>
                  {l.diferenca >= 0 ? "+" : "−"}
                  {brl(Math.abs(l.diferenca))}
                  <span className="ml-2 text-xs font-normal">{pct(l.variacao)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        Vire a chave do cutover quando a diferença estiver dentro de{" "}
        <strong>{Math.round(TOLERANCIA * 100)}%</strong> <strong>por vendedor</strong> — não apenas
        no total. Mensalidade, repasse e fardamento não contam para vendedor e por isso não aparecem
        aqui: eles existem só na origem Conta Azul e não têm contraparte manual.
      </p>
    </section>
  );
}
