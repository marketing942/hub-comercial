/**
 * A ORIGEM do faturamento que uma tela está lendo.
 *
 * O Hub vai conviver, até o cutover, com duas verdades sobre o mesmo mês: o que
 * os vendedores lançaram à mão e o que veio do Conta Azul. As duas moram na
 * MESMA tabela (`sales.origem`), e a tela escolhe qual lê.
 *
 * ## Por que isto é um parâmetro, e não duas telas
 *
 * O GAV (/admin/gav) existe para responder "o faturamento do Conta Azul está
 * certo?". Se ele tivesse código próprio, bater com o manual não provaria nada
 * sobre o cutover — provaria só que dois programas diferentes chegaram ao mesmo
 * número uma vez. Lendo a outra origem pelo MESMO caminho, o que o GAV mostra
 * hoje é literalmente o que o dashboard vai mostrar depois.
 *
 * ## O cutover é uma linha
 *
 * Quando o Conta Azul for a única fonte, troque `FONTE_PADRAO` para
 * `"conta_azul"`: o dashboard normal passa a mostrar o que o GAV mostrava, sem
 * mais nenhuma alteração de código.
 */
export type Fonte = "manual" | "conta_azul";

/** O que as telas normais leem. Trocar isto É o cutover. */
export const FONTE_PADRAO: Fonte = "manual";

export const FONTE_LABEL: Record<Fonte, string> = {
  manual: "Lançamento manual",
  conta_azul: "Conta Azul",
};

export function fonteValida(v: unknown): v is Fonte {
  return v === "manual" || v === "conta_azul";
}
