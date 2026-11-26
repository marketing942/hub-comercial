/**
 * Regras sobre as categorias do Conta Azul que o Jarvis manda (puro, sem banco).
 *
 * O Jarvis envia o cadastro inteiro (receita E despesa) sem dizer qual e qual.
 * No plano de contas da empresa so a receita e numerada ("1.0 - ...", "2.4 - ...");
 * despesa nao tem codigo.
 */

/** Numeradas que nao sao receita de venda: nao entram na fila de classificacao. */
const NAO_E_VENDA = /a identificar|rendimento|empr[eé]stimo/i;

export function ehCategoriaDeReceita(codigo: string | null, nome: string | null): boolean {
  const n = nome ?? "";
  if (NAO_E_VENDA.test(n)) return false;
  const cod = codigo || n.match(/^\s*(\d+\.\d+)\s*-/)?.[1] || "";
  // "1.x" e "2.x" sao a receita operacional ("2.1 - SUPLETIVO"); antes so a "1.x"
  // passava, e uma categoria nova "2.x" ficava invisivel ate ter a primeira venda.
  if (/^[12](\.|\s|$)/.test(cod)) return true;
  return /^\s*(re)?matr[ií]cula/i.test(n);
}

/** "codigo - nome", sem repetir o codigo quando o nome ja vem com ele. */
export function nomeDaCategoria(codigo: string | null, nome: string | null): string | null {
  if (nome && /^\s*\d+(\.\d+)*\s*-/.test(nome)) return nome.trim();
  return [codigo, nome].filter(Boolean).join(" - ") || null;
}

/**
 * Categorias separadas em 26/11/2026 (Eventos saiu de Turmas; Rematricula saiu de
 * Matricula). Os ITENS delas sao os mesmos das categorias de origem, entao aqui
 * quem decide "conta para o vendedor" e a CATEGORIA, e nao o item classificado.
 */
export function categoriaDecide(nome: string | null | undefined): boolean {
  return /rematr[ií]cula|\bevento/i.test(nome ?? "");
}
