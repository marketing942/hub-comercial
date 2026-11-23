/**
 * Nomes de mês e os tipos do mês a mês — SEM nenhum import de servidor.
 *
 * ## Por que este arquivo existe
 *
 * `vendasMes.ts` importa `supabaseAdmin`, que exige `SUPABASE_SERVICE_ROLE_KEY`
 * e só pode existir no servidor. Um componente `"use client"` que importe
 * QUALQUER VALOR de lá — um nome de mês que seja — arrasta o módulo inteiro
 * para o bundle do navegador, e o `createClient` estoura com "supabaseKey is
 * required" na hidratação.
 *
 * O detalhe que engana: `import type` é apagado na compilação e não arrasta
 * nada, então importar só tipos é seguro. Foi misturar um valor no mesmo
 * import que quebrou (2026-11-23).
 *
 * Regra: o que o cliente precisa mora aqui. `vendasMes.ts` reexporta para quem
 * já importava de lá.
 */
import type { BU } from "./products";

export const MES_NOME = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const MES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

/** Uma fatia do mês (uma BU, um vendedor ou uma categoria). */
export type Fatia = {
  chave: string;
  rotulo: string;
  valor: number;
  vendas: number;
};

export type MesResumo = {
  /** 1–12. */
  mes: number;
  rotulo: string;
  valor: number;
  vendas: number;
  /** Soma das quantidades — não é o mesmo que `vendas` (uma linha pode ser x50). */
  unidades: number;
  /** Média por venda. Zero quando não houve venda, nunca NaN. */
  ticket: number;
  /** Valor por BU, na ordem fixa das BUs (nunca por ranking: a cor é da BU). */
  porBu: Record<BU, number>;
  porVendedor: Fatia[];
  porCategoria: Fatia[];
  /** O dia que mais faturou no mês, para o pop-up. `null` se o mês foi vazio. */
  melhorDia: { data: string; valor: number; vendas: number } | null;
  /** Variação contra o mês anterior, em %. `null` quando não há base. */
  variacao: number | null;
};

export type VendaDetalhe = {
  id: string;
  data: string;
  vendedor: string;
  valor: number;
  quantidade: number;
};

export type CategoriaDetalhe = {
  chave: string;
  rotulo: string;
  bu: BU;
  valor: number;
  unidades: number;
  vendas: VendaDetalhe[];
};

export type VendasAno = {
  year: number;
  meses: MesResumo[];
  total: number;
  /** O mês cuja lista venda a venda veio junto. */
  mesSelecionado: number;
  detalhe: CategoriaDetalhe[];
  /** Quando o espelho do Conta Azul foi atualizado pela última vez. */
  sync: { em: string | null; erro: string | null };
};
