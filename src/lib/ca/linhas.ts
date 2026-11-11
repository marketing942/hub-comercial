import {
  COLEGIO_PRODUCT_IDS,
  CPPEM_PRODUCT_IDS,
  UNICIVE_PRODUCT_IDS,
} from "@/lib/products";

/**
 * As linhas que `sales`/`direct_sales` aceitam — as mesmas que o vendedor vê.
 *
 * Validar contra esta lista não é preciosismo: `buFromProductLine()` devolve
 * `cppem` para qualquer linha desconhecida, **sem erro**. Uma linha nova
 * digitada errada no mapa viraria faturamento do CPPEM em silêncio.
 */
export const LINHAS_VENDEDOR = new Set<string>([
  ...CPPEM_PRODUCT_IDS,
  ...UNICIVE_PRODUCT_IDS,
  ...COLEGIO_PRODUCT_IDS,
]);

/**
 * Linhas que existem SÓ na receita do grupo (`ca_receita`).
 *
 * ## Por que elas não estão em `products.ts`
 *
 * A mensalidade do Colégio é R$ 132 mil em 70 dias — receita real, que precisa
 * aparecer. Mas o Colégio é medido em QUANTIDADE de matrículas
 * (`isQtdPrimary`), e as linhas dele são as 12 séries: jogar 54 mensalidades do
 * 6º ano em `matricula_fund_6` transformaria 54 pagamentos mensais em 54 alunos
 * novos.
 *
 * Criar a linha em `products.ts` resolveria o valor e quebraria outra coisa:
 * `PRODUCT_LINES_COLEGIO` é o que alimenta o formulário do vendedor e os
 * dashboards atuais — apareceria uma opção nova para lançar à mão e uma linha
 * "R$ 0,00" no painel de quem não pediu mudança nenhuma. O pedido foi explícito:
 * nada do que já funciona pode mudar.
 *
 * Então elas vivem aqui: válidas para `ca_receita`, invisíveis para `sales`.
 * Qualquer linha deste conjunto obriga `conta_vendedor = false`.
 */
export const LINHAS_GRUPO = new Set<string>([
  "mensalidade_colegio",
  "eventos_colegio",
  "reforco_colegio",
  "repasse_unicive",
  "livros_colegio",
]);

export const ROTULOS_GRUPO: Record<string, string> = {
  mensalidade_colegio: "Mensalidades do Colégio",
  eventos_colegio: "Eventos do Colégio",
  reforco_colegio: "Reforço escolar",
  repasse_unicive: "Repasse de mensalidade Unicive",
  livros_colegio: "Livros",
};

/** A linha é aceitável para este destino? */
export function linhaValida(linha: string | null, contaVendedor: boolean): boolean {
  if (!linha) return false;
  return contaVendedor ? LINHAS_VENDEDOR.has(linha) : LINHAS_VENDEDOR.has(linha) || LINHAS_GRUPO.has(linha);
}
