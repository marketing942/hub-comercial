/** Tipos da tela de metas por linha de receita (sem import de servidor). */
export type CategoriaMeta = {
  id: string;
  nome: string;
  /** Conta para o vendedor (entra na meta total da BU); senao so aparece na Gestao a Vista. */
  conta: boolean;
  /** Receita do mes nessa categoria (todas as origens). */
  realizado: number;
  qtd: number;
  meta_valor: number;
  meta_qtd: number;
  /** Valor equivalente nas metas antigas (por linha do Hub), para converter. */
  antiga_valor: number;
  antiga_qtd: number;
};

export type MetasLinhaResposta = {
  categorias: CategoriaMeta[];
  /** A tabela ca_metas_linha ainda nao existe (rodar supabase/ca-04-metas-linha.sql). */
  semTabela: boolean;
};

/** Categoria com realizado x meta, para os dashboards e a Gestao a Vista. */
export type CategoriaCA = {
  id: string;
  nome: string;
  valor: number;
  qtd: number;
  meta_valor: number;
  meta_qtd: number;
};
