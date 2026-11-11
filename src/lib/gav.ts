/**
 * GAV — a comparação entre o faturamento lançado à mão e o que vem do Conta Azul.
 *
 * O dashboard do GAV mostra o mês como ele ficaria DEPOIS do cutover. Mas um
 * dashboard idêntico em outra aba não responde "está certo?": obriga a comparar
 * de olho, número a número. Esta função é a resposta — ela põe as duas origens
 * lado a lado e mostra a diferença.
 *
 * ## Por vendedor, não só no total
 *
 * O total pode fechar por compensação (um vendedor a mais, outro a menos) e
 * esconder exatamente o erro que mais dói, que é o número individual — é sobre
 * ele que caem meta e comissão. Por isso a comparação é por pessoa, e o total é
 * só o resumo.
 *
 * ## Custo
 *
 * São duas passadas pelos mesmos leitores de `data.ts`, uma por origem. Os
 * loaders são memoizados por (ano, mês, **fonte**), então cada origem é lida uma
 * vez por requisição — não é o dobro do trabalho de uma tela, é o trabalho de
 * duas telas, que é o que de fato se está comparando.
 */
import { supabaseAdmin } from "./supabase";
import { lerTudo } from "./ca/ler";
import { ROTULOS_GRUPO } from "./ca/linhas";
import { productLabel } from "./products";
import { buListOf, listSellers, statsForAll } from "./data";
import type { SellerStats } from "./calc";
import type { Fonte } from "./fonte";
import { FONTE_PADRAO } from "./fonte";

export type LinhaComparacao = {
  chave: string;
  rotulo: string;
  bu: SellerStats["bu"] | null;
  manual: number;
  contaAzul: number;
  /** contaAzul − manual. Negativo = o Conta Azul está vendo menos. */
  diferenca: number;
  /** Variação relativa sobre o manual (0–1). `null` quando o manual é zero. */
  variacao: number | null;
};

export type Comparacao = {
  year: number;
  month: number;
  total: LinhaComparacao;
  porVendedor: LinhaComparacao[];
  porBu: LinhaComparacao[];
  /** A migração `ca-01-origem.sql` ainda não rodou — ver `loadMonthSales`. */
  semColunaOrigem: boolean;
  /**
   * O que está esperando alguém. Fica no painel, e não só na aba de
   * Classificação: vendedor novo no Conta Azul aparece aqui no dia seguinte,
   * em vez de depender de alguém lembrar de abrir a outra tela.
   */
  pendencias: { categorias: number; itens: number; vendedores: number };
};

const variacao = (manual: number, ca: number): number | null =>
  manual > 0 ? ca / manual - 1 : null;

function linha(chave: string, rotulo: string, bu: SellerStats["bu"] | null, manual: number, ca: number): LinhaComparacao {
  return { chave, rotulo, bu, manual, contaAzul: ca, diferenca: ca - manual, variacao: variacao(manual, ca) };
}

export async function compararFontes(year: number, month: number): Promise<Comparacao> {
  const [manual, ca, pendencias] = await Promise.all([
    statsForAll({ year, month, fonte: FONTE_PADRAO }),
    statsForAll({ year, month, fonte: "conta_azul" satisfies Fonte }),
    contarPendencias(),
  ]);

  /**
   * Soma por (vendedor × BU) e agrega depois.
   *
   * `statsForAll` devolve UMA linha por par (vendedor, BU) — um vendedor
   * multi-BU aparece duas vezes. Somar direto por `sellerId` sem passar pela BU
   * continuaria certo no total, mas perderia a quebra por unidade, que é onde a
   * divergência costuma estar (a Unicive do Victor e do Pablo, por exemplo).
   */
  const porPessoa = new Map<string, { nome: string; bu: SellerStats["bu"]; manual: number; ca: number }>();
  const soma = (linhas: SellerStats[], campo: "manual" | "ca") => {
    for (const s of linhas) {
      const k = `${s.sellerId}|${s.bu}`;
      const a = porPessoa.get(k) ?? { nome: s.sellerName, bu: s.bu, manual: 0, ca: 0 };
      a[campo] += s.valorRealizado;
      porPessoa.set(k, a);
    }
  };
  soma(manual, "manual");
  soma(ca, "ca");

  const porVendedor = [...porPessoa]
    .map(([k, a]) => linha(k, a.nome, a.bu, a.manual, a.ca))
    .sort((x, y) => y.manual - x.manual);

  const porBuMap = new Map<SellerStats["bu"], { manual: number; ca: number }>();
  for (const a of porPessoa.values()) {
    const b = porBuMap.get(a.bu) ?? { manual: 0, ca: 0 };
    b.manual += a.manual;
    b.ca += a.ca;
    porBuMap.set(a.bu, b);
  }
  const porBu = [...porBuMap].map(([bu, a]) => linha(bu, bu, bu, a.manual, a.ca)).sort((x, y) => y.manual - x.manual);

  const totManual = porVendedor.reduce((s, l) => s + l.manual, 0);
  const totCa = porVendedor.reduce((s, l) => s + l.contaAzul, 0);

  /**
   * Heurística honesta para "a migração não rodou": o manual tem número e o
   * Conta Azul está zerado em TUDO. Não é prova — um mês legitimamente sem
   * venda do CA daria o mesmo —, por isso a tela trata como aviso, não como
   * erro, e diz o que conferir.
   */
  const semColunaOrigem = totManual > 0 && totCa === 0;

  return {
    year,
    month,
    total: linha("total", "Total", null, totManual, totCa),
    porVendedor,
    porBu,
    semColunaOrigem,
    pendencias,
  };
}

/**
 * Quantos itens esperam classificação.
 *
 * ## Item pendente é o que a CATEGORIA não resolve
 *
 * Dois casos, e por muito tempo esta função só contava o primeiro:
 *
 *  1. venda **sem categoria** (nasceu no site);
 *  2. venda com categoria classificada **sem linha**, de propósito: `1.7
 *     MATRÍCULA COLÉGIO` sabe a BU e que conta para vendedor, mas não sabe a
 *     SÉRIE — são 12, e só o nome do item diz qual.
 *
 * Faltando o caso 2, o aviso dizia "0 itens" enquanto R$ 157 mil do Colégio
 * estavam parados. Um contador que mente para baixo é pior que não ter
 * contador: ele afirma que está tudo certo.
 *
 * Um contador que não se pode zerar também é ruído, então item em venda que a
 * categoria já resolve continua fora da conta — classificá-lo não mudaria nada.
 */
async function contarPendencias(): Promise<{ categorias: number; itens: number; vendedores: number }> {
  const n = async (tabela: string, aplicar: (q: ReturnType<typeof supabaseAdmin.from>) => unknown) => {
    const q = supabaseAdmin.from(tabela).select("*", { count: "exact", head: true });
    const { count } = (await (aplicar(q as never) as Promise<{ count: number | null }>)) ?? { count: 0 };
    return count ?? 0;
  };

  const vendedores = await n("ca_vendedores", (q) => (q as never as typeof q & { eq: Function }).eq("destino", "pendente"));

  const mapa = await lerTudo<{ ca_tipo: string; ca_id: string; product_line: string | null; ignorar: boolean }>(
    "ca_mapa_receita",
    "ca_tipo, ca_id, product_line, ignorar",
  );
  const resolve = (m?: { product_line: string | null; ignorar: boolean }) => !!m && (!!m.product_line || m.ignorar);
  const porCategoria = new Map(mapa.filter((m) => m.ca_tipo === "categoria").map((m) => [m.ca_id, m]));
  const porItem = new Map(mapa.filter((m) => m.ca_tipo === "item").map((m) => [m.ca_id, m]));

  /**
   * Categoria pendente: sem linha E sem `ignorar`.
   *
   * `1.7 MATRÍCULA COLÉGIO` cai aqui de propósito e não deveria: ela ESTÁ
   * decidida (BU + conta para vendedor), só não tem linha porque a linha é a
   * série. O que a distingue é ter sido classificada uma vez —
   * `classificado_em` preenchido.
   */
  const categorias = (
    await lerTudo<{ ca_id: string; product_line: string | null; ignorar: boolean; classificado_em: string | null }>(
      "ca_mapa_receita",
      "ca_id, ca_tipo, product_line, ignorar, classificado_em",
      { filtrar: (q) => (q as never as { eq: Function }).eq("ca_tipo", "categoria") },
    )
  ).filter((c) => !c.product_line && !c.ignorar && !c.classificado_em).length;

  // Vendas que a categoria não resolve — é nelas que o item tem a palavra.
  const vendas = await lerTudo<{ ca_id: string; categoria_ca_id: string | null }>(
    "ca_vendas",
    "ca_id, categoria_ca_id",
  );
  const semLinha = new Set<string>();
  for (const v of vendas) {
    if (resolve(v.categoria_ca_id ? porCategoria.get(v.categoria_ca_id) : undefined)) continue;
    semLinha.add(v.ca_id);
  }

  let itens = 0;
  if (semLinha.size) {
    const todosItens = await lerTudo<{ item_ca_id: string | null; venda_ca_id: string }>(
      "ca_venda_itens",
      "ca_id, item_ca_id, venda_ca_id",
    );
    const alvo = new Set<string>();
    for (const i of todosItens) {
      if (i.item_ca_id && semLinha.has(i.venda_ca_id)) alvo.add(i.item_ca_id);
    }
    for (const id of alvo) if (!resolve(porItem.get(id))) itens++;
  }

  return { categorias, itens, vendedores };
}

/**
 * A receita que não aparece em nenhum painel de vendedor.
 *
 * ## Por que ela precisa de um lugar
 *
 * `ca_receita` sempre foi escrita e nunca foi lida. São duas coisas diferentes
 * morando ali, e as duas somem se ninguém mostrar:
 *
 *  - **não conta para vendedor** — mensalidade do Colégio (R$ 56–61 mil por
 *    mês), fardamento, livro, evento. É receita do grupo de verdade, e o pedido
 *    foi um painel que mostre TODA a receita por linha. Sem esta leitura, o GAV
 *    mostrava R$ 80 mil de novembro e escondia os outros R$ 60 mil;
 *  - **conta para vendedor, mas chegou sem vendedor** — a "venda sem dono".
 *    Essa é defeito, não desenho: alguém lançou no Conta Azul com um vendedor
 *    que o Hub não conhece. Fica em vermelho porque é tarefa.
 *
 * Elas ficam separadas na tela de propósito: somar as duas produziria um número
 * que ninguém sabe o que fazer com ele.
 */
export type LinhaGrupo = {
  chave: string;
  rotulo: string;
  bu: string | null;
  valor: number;
  itens: number;
};

export type ReceitaGrupo = {
  /** Receita do grupo por desenho: mensalidade, fardamento, livro, evento. */
  doGrupo: LinhaGrupo[];
  /** Conta para vendedor e chegou sem vendedor mapeado. É tarefa. */
  semDono: LinhaGrupo[];
  totalGrupo: number;
  totalSemDono: number;
  /**
   * A herança por BU, explicada na tela.
   *
   * O normalizador manda a linha sem dono para o vendedor da BU quando a BU tem
   * um vendedor ativo só. Isso move dinheiro para o painel de alguém, então não
   * pode ser invisível: a tela diz quem herda, quanto herdou e por quê.
   */
  heranca: { bu: string; vendedor: string }[];
  herdados: { linhas: number; valor: number } | null;
};

export async function receitaDoGrupo(year: number, month: number): Promise<ReceitaGrupo> {
  const de = `${year}-${String(month).padStart(2, "0")}-01`;
  // Primeiro dia do mês seguinte, exclusivo: evita acertar o último dia do mês
  // na mão (28/29/30/31) e errar em fevereiro.
  const ate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

  const linhas = await lerTudo<{
    product_line: string | null;
    bu: string | null;
    valor: number | null;
    conta_vendedor: boolean;
  }>("ca_receita", "ca_venda_id, product_line, bu, valor, conta_vendedor", {
    ordenarPor: "ca_venda_id",
    filtrar: (q) => (q as never as { gte: Function }).gte("sale_date", de).lt("sale_date", ate),
  });

  const juntar = (filtro: (l: { conta_vendedor: boolean }) => boolean): LinhaGrupo[] => {
    const m = new Map<string, LinhaGrupo>();
    for (const l of linhas) {
      if (!filtro(l)) continue;
      const k = l.product_line ?? "(sem linha)";
      const a = m.get(k) ?? { chave: k, rotulo: rotuloLinha(k), bu: l.bu ?? null, valor: 0, itens: 0 };
      a.valor += Number(l.valor ?? 0);
      a.itens += 1;
      m.set(k, a);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  };

  const doGrupo = juntar((l) => !l.conta_vendedor);
  const semDono = juntar((l) => l.conta_vendedor);

  // Quem herda: a mesma regra do normalizador — BU com um vendedor ativo só.
  const ativos = await listSellers({ onlyActive: true });
  const porBu = new Map<string, { id: string; name: string }[]>();
  for (const sel of ativos) {
    for (const bu of buListOf(sel)) porBu.set(bu, [...(porBu.get(bu) ?? []), { id: sel.id, name: sel.name }]);
  }
  const heranca = [...porBu]
    .filter(([, ids]) => ids.length === 1)
    .map(([bu, ids]) => ({ bu, vendedor: ids[0].name }));

  // Quanto a última normalização de fato herdou — o número do processo, não um
  // recálculo paralelo que poderia discordar dele.
  const { data: sync } = await supabaseAdmin.from("ca_sync").select("resumo").eq("recurso", "vendas").maybeSingle();
  const n = (sync?.resumo as { normalizacao?: { herdadosPelaBu?: number; valorHerdado?: number } } | null)?.normalizacao;
  const herdados = n && (n.herdadosPelaBu ?? 0) > 0 ? { linhas: n.herdadosPelaBu ?? 0, valor: n.valorHerdado ?? 0 } : null;

  return {
    doGrupo,
    semDono,
    totalGrupo: doGrupo.reduce((s, l) => s + l.valor, 0),
    totalSemDono: semDono.reduce((s, l) => s + l.valor, 0),
    heranca,
    herdados,
  };
}

/** Rótulo da linha, venha ela de `products.ts` ou só da receita do grupo. */
function rotuloLinha(id: string): string {
  return ROTULOS_GRUPO[id] ?? productLabel(id);
}
