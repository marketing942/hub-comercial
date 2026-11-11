/**
 * A receita que não é de vendedor nenhum.
 *
 * ## Por que ela fica fora da faixa de comparação
 *
 * `GavComparativo` compara manual × Conta Azul por vendedor. Mensalidade do
 * Colégio não tem contraparte manual — ninguém lança mensalidade à mão —, então
 * ela entraria lá como "+R$ 56 mil de diferença" e faria a conferência parecer
 * quebrada justamente quando está certa. Aqui ela é o assunto, não o resíduo.
 *
 * ## Dois blocos, nunca somados
 *
 * "Receita do grupo" é desenho: mensalidade, fardamento, livro, evento. "Sem
 * dono" é defeito: a linha CONTA para vendedor e chegou sem vendedor que o Hub
 * reconheça. Os totais ficam separados porque as ações são opostas — um é para
 * ler, o outro é para corrigir.
 */
import Link from "next/link";

import { COLOR } from "@/lib/brand";
import type { LinhaGrupo, ReceitaGrupo } from "@/lib/gav";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BU_NOME: Record<string, string> = {
  cppem: "CPPEM",
  unicive: "UNICIVE",
  colegio_cppem: "Colégio",
};

function Tabela({ linhas, cor }: { linhas: LinhaGrupo[]; cor: string }) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <table className="w-full text-sm">
      <tbody className="tabular-nums">
        {linhas.map((l) => (
          <tr key={l.chave} className="border-t border-[var(--hair)]/50">
            <td className="py-1.5">{l.rotulo}</td>
            <td className="py-1.5 font-ui text-[11px] uppercase tracking-[.1em] text-white/35">
              {BU_NOME[l.bu ?? ""] ?? "—"}
            </td>
            <td className="py-1.5 text-right text-white/40">{l.itens}</td>
            <td className="py-1.5 text-right font-semibold" style={{ color: cor }}>
              {brl(l.valor)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-[var(--hair)]">
          <th scope="row" className="py-1.5 text-left font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
            Total
          </th>
          <td />
          <td />
          <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: cor }}>
            {brl(total)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function GavReceitaGrupo({ dados }: { dados: ReceitaGrupo }) {
  const { doGrupo, semDono, totalSemDono } = dados;
  if (doGrupo.length === 0 && semDono.length === 0) return null;

  return (
    <section className="panel mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow-label">Receita fora do painel de vendedor</h2>
        <span className="font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
          só existe na origem Conta Azul
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {doGrupo.length > 0 ? (
          <div>
            <p className="kpi-label mb-1 text-white/40">Receita do grupo</p>
            <p className="mb-2 text-[11px] leading-relaxed text-white/40">
              Mensalidade, fardamento, livro e evento: receita real que, por decisão, não entra em
              meta nem comissão de ninguém.
            </p>
            <Tabela linhas={doGrupo} cor={COLOR.ok} />
          </div>
        ) : null}

        {semDono.length > 0 ? (
          <div>
            <p className="kpi-label mb-1" style={{ color: COLOR.danger }}>
              Sem dono · {brl(totalSemDono)}
            </p>
            <p className="mb-2 text-[11px] leading-relaxed text-white/40">
              Estas linhas <strong>contam</strong> para vendedor, mas chegaram com um vendedor que o
              Hub não reconhece — então não entram no painel de ninguém.{" "}
              <Link href="/admin/gav/mapa" className="underline decoration-dotted hover:opacity-80">
                Ligar o vendedor
              </Link>{" "}
              move este valor para o painel certo no próximo reprocessamento.
            </p>
            <Tabela linhas={semDono} cor={COLOR.danger} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
