"use client";
import { useMemo } from "react";
import { productLabel } from "@/lib/products";
import { BRL, fmtInt } from "@/lib/calc";

type Sale = {
  id: string;
  sale_date: string;
  product_line: string;
  valor: number;
  quantidade: number;
};

/**
 * A lista de vendas do vendedor — SÓ LEITURA desde o cutover (2026-11-23).
 *
 * ## O que saiu, e por quê
 *
 * O botão "Nova venda", o modal e os controles de editar/apagar foram embora
 * junto com o lançamento à mão. O caminho de escrita (`POST /api/sales`,
 * `PATCH`/`DELETE /api/sales/:id`) continua existindo e recusando — fechar a
 * porta no servidor é o que vale; esconder o botão é só cortesia.
 *
 * Saíram também três COLUNAS: Cliente, Origem (ligação) e Indicação. Não foi
 * economia de espaço — é que o Conta Azul não as preenche. Medido em
 * 2026-11-23 sobre as 1.416 linhas automáticas: `cliente_nome` nulo em 100%
 * delas, e `ligacao_status`/`indicacao_status` no valor padrão
 * (`sem_ligacao` / `sem_indicacao`) em 100%. Mantê-las seria mostrar três
 * colunas vazias e deixar o vendedor achar que perdeu dado.
 *
 * O nome do cliente VOLTA quando a migration `supabase/ca-03-cliente-nome.sql`
 * rodar — o código que o traz está pronto no branch `cliente-nome-conferencia`.
 */
export default function SalesClient({ initial }: { initial: Sale[] }) {
  const list = initial;

  // `valor` é o TOTAL da linha (a ponte converte o unitário do Conta Azul —
  // ver `src/lib/ca/normaliza.ts`), então aqui é soma simples, sem multiplicar.
  const totalValor = useMemo(() => list.reduce((a, b) => a + Number(b.valor || 0), 0), [list]);
  const totalQtd = useMemo(() => list.reduce((a, b) => a + Number(b.quantidade || 0), 0), [list]);

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border flex-wrap">
          <div className="text-sm font-semibold">Vendas do mes</div>
          <div className="text-xs text-white/60">
            {list.length} venda{list.length === 1 ? "" : "s"} - {BRL.format(totalValor)} -{" "}
            {fmtInt.format(totalQtd)} unidade{totalQtd === 1 ? "" : "s"}
          </div>
        </div>
        <table className="table-stack w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-white/40 bg-panel2">
            <tr className="text-left">
              <th className="p-3">Data</th>
              <th className="p-3">Produto</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-white/50">
                  Nenhuma venda sua chegou do Conta Azul este mes ainda.
                </td>
              </tr>
            )}
            {list.map((s) => (
              <tr key={s.id} className="border-t border-border/60">
                <td className="p-3 whitespace-nowrap tabular-nums">{fmtData(s.sale_date)}</td>
                <td className="p-3">{productLabel(s.product_line)}</td>
                <td className="p-3 tabular-nums">{BRL.format(Number(s.valor || 0))}</td>
                <td className="p-3 tabular-nums">{fmtInt.format(Number(s.quantidade || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/40">
        Esta lista vem do Conta Azul e se atualiza sozinha. Se uma venda sua nao
        aparecer aqui, fale com o administrador — e um item que ainda nao foi
        classificado, nao uma venda perdida.
      </p>
    </div>
  );
}

/** "2026-11-23" → "23/11". Sem `new Date()`: a string já vem no fuso certo. */
function fmtData(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}
