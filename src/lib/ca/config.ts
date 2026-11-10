/**
 * Constantes do dado que vem do Conta Azul.
 *
 * O OAuth saiu daqui em 10/11/2026: o Hub não fala com o Conta Azul. Quem fala é
 * o Jarvis, e o Hub lê o espelho dele — ver `./ponte.ts` para o motivo (testado
 * contra a conta real: um app aceita UMA url de redirect, e app "de produção"
 * não é reconhecido pelo Cognito da API v2).
 */

/**
 * Situações de venda que contam como faturamento.
 *
 * Medido no espelho desta empresa: aparecem `Faturado`, `Aprovado` e
 * `Cancelado`. Tudo que não estiver aqui é tratado como REMOÇÃO — a venda sai
 * das tabelas do Hub. Sem esse caminho, cancelar no Conta Azul deixaria a linha
 * viva para sempre, porque reprocessar só o que mudou não desfaz o que já
 * gravou.
 */
export const CA_SITUACOES_VALIDAS = ["Faturado", "Aprovado"] as const;

export function situacaoConta(s: string | null | undefined): boolean {
  return (CA_SITUACOES_VALIDAS as readonly string[]).includes(String(s ?? ""));
}
