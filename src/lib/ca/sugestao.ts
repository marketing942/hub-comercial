/**
 * Pré-preenchimento da tela de classificação.
 *
 * ## Sugerir sim, decidir não
 *
 * Nada aqui grava coisa alguma. Tudo é palpite que aparece no formulário com
 * selo de "sugerido" e que um humano confirma com um clique. A diferença
 * importa: uma regra que roda sozinha em produção muda de resposta no dia em
 * que alguém renomeia uma categoria ou cadastra um vendedor com nome parecido —
 * e muda em silêncio. Um palpite errado numa tela é visto e corrigido.
 *
 * ## Por que ler texto é seguro AQUI
 *
 * As categorias do Conta Azul são uma lista curta mantida pela contabilidade
 * ("1.5 - MATRÍCULA UNICIVE", "1.8 - MENSALIDADE COLÉGIO"), não nomes livres de
 * produto. É o oposto do catálogo de itens, onde `MENSALIDADE - 6º Ano` e
 * `EBOOK - MENSAL COLÉGIO 6 FUND` são a mesma coisa com nomes diferentes — e é
 * por isso que lá o palpite vem do histórico, não do texto.
 */

/** Tira acento, caixa e letra repetida — "Lilliane" e "Liliane" viram o mesmo. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(.)\1+/g, "$1")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PalpiteCategoria {
  bu: string;
  /** Vazio quando a categoria não cai numa linha só — ver `MATRÍCULA COLÉGIO`. */
  product_line: string;
  conta_vendedor: boolean;
  ignorar: boolean;
  /** O que fez o palpite, em uma linha — para a tela explicar em vez de só mostrar. */
  porque: string;
}

/**
 * Categoria → BU, linha de receita e regra.
 *
 * A ordem importa: a primeira regra que casar vence. `MENSALIDADE` vem antes de
 * `COLÉGIO` porque a palavra que decide se conta para vendedor é mais
 * específica que a que decide a BU.
 */
const REGRAS: { quando: RegExp; bu: string; linha: string; conta: boolean; ignorar?: boolean; porque: string }[] = [
  // Não é faturamento de ninguém.
  { quando: /\bFRETE/, bu: "", linha: "", conta: false, ignorar: true, porque: "frete não é faturamento" },
  { quando: /\bMULTA/, bu: "", linha: "", conta: false, ignorar: true, porque: "multa não é faturamento" },
  { quando: /RENDIMENTO|EMPRESTIMO|SUBLOCACAO|ATIVO IMOBILIZADO/, bu: "", linha: "", conta: false, ignorar: true, porque: "não é venda" },

  // Recorrente: é consequência de matrícula já feita, não esforço de venda.
  { quando: /MENSALIDADE.*COLEGIO|COLEGIO.*MENSALIDADE/, bu: "colegio_cppem", linha: "", conta: false, porque: "mensalidade não conta para vendedor" },
  { quando: /REPASSE.*UNICIVE|MENSALIDADE.*UNICIVE/, bu: "unicive", linha: "", conta: false, porque: "repasse não conta para vendedor" },

  // Acessório do Colégio: decidido em 10/11 que não conta para vendedor.
  { quando: /FARDAMENTO/, bu: "colegio_cppem", linha: "fardamentos", conta: false, porque: "fardamento não conta para vendedor" },
  { quando: /LIVRO/, bu: "colegio_cppem", linha: "", conta: false, porque: "livros não contam para vendedor" },
  { quando: /EVENTO.*COLEGIO/, bu: "colegio_cppem", linha: "", conta: false, porque: "evento do Colégio não conta para vendedor" },

  // Matrícula: é o que conta para o vendedor.
  // O Colégio fica SEM linha de propósito: são 12 séries e só o nome do item
  // diz qual. A linha sai do item (ver §4 do documento).
  { quando: /MATRICULA.*COLEGIO/, bu: "colegio_cppem", linha: "", conta: true, porque: "matrícula conta; a série vem do item" },
  { quando: /MATRICULA.*UNICIVE/, bu: "unicive", linha: "matriculas", conta: true, porque: "matrícula Unicive conta para vendedor" },

  // CPPEM, uma categoria por linha de receita.
  { quando: /TURMA.*PRESENCIA/, bu: "cppem", linha: "turmas_presenciais", conta: true, porque: "turmas presenciais" },
  { quando: /MENTORIA/, bu: "cppem", linha: "mentorias", conta: true, porque: "mentorias" },
  { quando: /CURSO.*ONLINE/, bu: "cppem", linha: "cursos_online", conta: true, porque: "cursos online" },
  { quando: /MATERIA.*DIGITA/, bu: "cppem", linha: "materiais_digitais", conta: true, porque: "materiais digitais" },
  { quando: /MATERIA.*FISIC/, bu: "cppem", linha: "fisicos", conta: true, porque: "materiais físicos" },
  { quando: /SUPLETIVO/, bu: "cppem", linha: "supletivo", conta: true, porque: "supletivo" },
];

export function palpitarCategoria(nome: string | null): PalpiteCategoria | null {
  if (!nome) return null;
  const n = normalizar(nome).toUpperCase();
  for (const r of REGRAS) {
    if (r.quando.test(n)) {
      return {
        bu: r.bu,
        product_line: r.linha,
        conta_vendedor: r.conta,
        ignorar: !!r.ignorar,
        porque: r.porque,
      };
    }
  }
  // Sem regra: pelo menos a BU, que o nome quase sempre diz.
  const bu = n.includes("UNICIVE") ? "unicive" : n.includes("COLEGIO") ? "colegio_cppem" : n.includes("CPPEM") ? "cppem" : "";
  return bu ? { bu, product_line: "", conta_vendedor: false, ignorar: false, porque: "BU pelo nome; a linha precisa de decisão" } : null;
}

export interface PalpiteVendedor {
  destino: "vendedor" | "canal_direto" | "grupo";
  sellerId: string | null;
  porque: string;
}

/**
 * Cadastro do Conta Azul → vendedor do Hub.
 *
 * Casa por NOME porque é tudo o que existe para casar: o `ca_vendedor_id` é um
 * UUID do Conta Azul e o `seller_id` é um UUID do Hub — não há nada em comum
 * entre os dois até alguém ligar os dois uma vez. Daí ser sugestão, nunca
 * gravação automática: um "Victor" novo no Conta Azul não pode herdar as vendas
 * do Victor que já existe só porque o nome bate.
 */
export function palpitarVendedor(
  caNome: string | null,
  sellers: { id: string; name: string }[],
): PalpiteVendedor | null {
  if (!caNome) return null;
  const n = normalizar(caNome);

  if (/\bsite\b|\bdireto\b|avulsa/.test(n)) {
    return { destino: "canal_direto", sellerId: null, porque: "venda de site, sem dono" };
  }
  if (/diretoria|contador|financeiro|administrat/.test(n)) {
    return { destino: "grupo", sellerId: null, porque: "lança venda, mas não é vendedor" };
  }

  const tokensCa = n.split(" ").filter((t) => t.length >= 4);
  for (const s of sellers) {
    const ns = normalizar(s.name);
    const tokensHub = ns.split(" ").filter((t) => t.length >= 4);
    const casa =
      ns === n ||
      tokensCa.some((t) => tokensHub.includes(t)) ||
      tokensHub.some((t) => tokensCa.includes(t));
    if (casa) {
      return { destino: "vendedor", sellerId: s.id, porque: `nome bate com "${s.name}"` };
    }
  }
  return null;
}

/**
 * Série do Colégio a partir do nome do item.
 *
 * `MATRÍCULA - 9º Ano Ensino Fundamental - COLÉGIO CPPEM` → `matricula_fund_9`.
 * Devolve `null` quando o nome não tem série.
 */
function serieColegio(n: string): string | null {
  const m = n.match(/(\d+)\s*(?:O|A)?\s*ANO\s+ENSINO\s+(FUNDAMENTAL|MEDIO)/);
  if (!m) return null;
  const nth = Number(m[1]);
  if (m[2] === "FUNDAMENTAL") return nth >= 1 && nth <= 9 ? `matricula_fund_${nth}` : null;
  return nth >= 1 && nth <= 3 ? `matricula_em_${nth}` : null;
}

/**
 * Item → BU e linha de receita, pelo NOME.
 *
 * ## Por que aqui o texto vale, e no catálogo em geral não
 *
 * O cabeçalho deste arquivo diz que no catálogo de itens o palpite vem do
 * histórico, não do texto — porque `MENSALIDADE - 6º Ano` e `EBOOK - MENSAL
 * COLÉGIO 6 FUND` são a mesma coisa com nomes diferentes. Isso continua valendo
 * para o CPPEM e a Unicive, e é o que a votação por categoria dominante resolve.
 *
 * O Colégio é a exceção, e por um motivo estrutural: o histórico **não pode**
 * responder. A categoria do Conta Azul não tem a série — são 12 séries e duas
 * categorias (`1.7 MATRÍCULA`, `1.8 MENSALIDADE`) — então nenhuma quantidade de
 * votos diz se a venda é do 6º ou do 9º ano. Só o nome do item diz. E o nome
 * dele é taxonomia de verdade aqui: um padrão único, mantido pela secretaria.
 *
 * ## As categorias 1.7 e 1.8 estão trocadas nos dados, e isso é esperado
 *
 * Medido em 11/11/2026: `1.7 - MATRÍCULA COLÉGIO` contém 7 itens MENSALIDADE
 * (R$ 4.154) e `1.8 - MENSALIDADE COLÉGIO` contém 2 itens MATRÍCULA (R$ 874).
 * Quem lança no Conta Azul erra a categoria de vez em quando — e é exatamente
 * por isso que a precedência do normalizador é item ANTES de categoria. O nome
 * do item é a fonte da verdade para o Colégio, não a categoria.
 */
export function palpitarItem(nome: string | null): PalpiteCategoria | null {
  if (!nome) return null;
  const n = normalizar(nome).toUpperCase();

  // ---- Colégio: a série sai do nome ------------------------------------
  const serie = serieColegio(n);
  if (serie) {
    // MENSALIDADE antes de MATRÍCULA: é a palavra que decide se conta para o
    // vendedor, e vem antes da que decide a linha.
    if (/MENSALIDADE/.test(n)) {
      return {
        bu: "colegio_cppem",
        product_line: "mensalidade_colegio",
        conta_vendedor: false,
        ignorar: false,
        porque: "mensalidade do Colégio: receita do grupo, não conta para vendedor",
      };
    }
    if (/MATRICULA/.test(n)) {
      return {
        bu: "colegio_cppem",
        product_line: serie,
        conta_vendedor: true,
        ignorar: false,
        porque: `matrícula do Colégio; a série (${serie}) saiu do nome do item`,
      };
    }
  }

  if (/REFORCO/.test(n)) {
    return { bu: "colegio_cppem", product_line: "reforco_colegio", conta_vendedor: false, ignorar: false, porque: "reforço escolar: receita do grupo" };
  }
  if (/DIA DAS CRIANCAS|DIA DOS PAIS|DIA DAS MAES|FESTA JUNINA|EVENT /.test(n)) {
    return { bu: "colegio_cppem", product_line: "eventos_colegio", conta_vendedor: false, ignorar: false, porque: "evento do Colégio: não vai para vendedor nenhum" };
  }
  if (/\bLIVRO/.test(n)) {
    return { bu: "colegio_cppem", product_line: "livros_colegio", conta_vendedor: false, ignorar: false, porque: "livros não contam para vendedor" };
  }
  return null;
}
