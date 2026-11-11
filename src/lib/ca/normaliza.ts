/**
 * Espelho do Conta Azul → tabelas que o Hub lê (`sales`, `direct_sales`,
 * `ca_receita`).
 *
 * ## A regra de segurança deste arquivo
 *
 * Toda escrita carrega `origem = 'conta_azul'` e **todo apagamento filtra por
 * ela**. Nenhuma linha lançada à mão pode ser tocada por este código, nem por
 * engano: o pedido foi explícito — não pode afetar nada do que já existe e
 * funciona. Se você mexer aqui, mantenha essa invariante.
 *
 * ## Por que apaga e regrava, em vez de só inserir
 *
 * Uma venda cancelada no Conta Azul muda de situação, mas a linha já está
 * gravada aqui. Reprocessar só o que mudou **não desfaz o que já foi gravado**.
 * Apagar a janela (sempre com o filtro de origem) e regravar resolve
 * cancelamento, item removido e reclassificação com o mesmo mecanismo, e é
 * idempotente por construção.
 *
 * ## Precedência da classificação: item ANTES de categoria
 *
 * A categoria (`1.5 - MATRÍCULA UNICIVE`) resolve quase tudo e é o que separa
 * matrícula de mensalidade. Mas ela não diz a SÉRIE do Colégio, e venda que
 * nasce no site chega **sem categoria nenhuma** — medido: 97% e 100% das vendas
 * de novembro de dois vendedores. Então o item tem a palavra final quando está
 * classificado, e a categoria é a rede embaixo.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { situacaoConta } from "./config";
import { lerPorChaves, lerTudo } from "./ler";
import { LINHAS_VENDEDOR, linhaValida } from "./linhas";

type Destino = "vendedor" | "canal_direto" | "grupo" | "pendente";

interface MapaLinha {
  bu: string | null;
  product_line: string | null;
  conta_vendedor: boolean;
  ignorar: boolean;
}

export interface ResultadoNormalizacao {
  vendasConsideradas: number;
  paraSales: number;
  paraDireto: number;
  paraGrupo: number;
  /** Itens sem classificação: não viram faturamento em lugar nenhum. */
  pendentes: number;
  valorPendente: number;
  /** Linhas que contam para vendedor mas chegaram sem vendedor mapeado. */
  semDono: number;
  valorSemDono: number;
  ignorados: number;
  linhaInvalida: number;
}

const vazio = (): ResultadoNormalizacao => ({
  vendasConsideradas: 0,
  paraSales: 0,
  paraDireto: 0,
  paraGrupo: 0,
  pendentes: 0,
  valorPendente: 0,
  semDono: 0,
  valorSemDono: 0,
  ignorados: 0,
  linhaInvalida: 0,
});

/**
 * Regrava a janela `[de, ate]` a partir do espelho.
 *
 * Só mexe em linhas `origem = 'conta_azul'`. As manuais do mesmo período ficam
 * exatamente como estão — é isso que mantém o dashboard atual intacto.
 */
export async function normalizarJanela(de: string, ate: string): Promise<ResultadoNormalizacao> {
  const r = vazio();

  // ---- 1. Lê o espelho da janela -----------------------------------------
  /**
   * PAGINADO. `.limit(20000)` não levanta o teto: o PostgREST corta em 1.000 e
   * não avisa. Em 11/11/2026 esta leitura devolvia 1.000 de 1.546 vendas e a
   * normalização perdia 35% do faturamento em silêncio.
   */
  const vendasRaw = await lerTudo<{
    ca_id: string;
    data: string;
    situacao: string | null;
    versao: number | null;
    cliente_ca_id: string | null;
    vendedor_ca_id: string | null;
    categoria_ca_id: string | null;
  }>("ca_vendas", "ca_id, data, situacao, versao, cliente_ca_id, vendedor_ca_id, categoria_ca_id", {
    filtrar: (q) => (q as never as { gte: Function }).gte("data", de).lte("data", ate),
  });
  const vendas = vendasRaw.filter((v) => situacaoConta(v.situacao));
  r.vendasConsideradas = vendas.length;

  const vendaIds = vendas.map((v) => v.ca_id as string);
  const itensRaw = await lerPorChaves<Record<string, unknown>>(
    "ca_venda_itens",
    "ca_id, venda_ca_id, item_ca_id, nome, quantidade, valor",
    "venda_ca_id",
    vendaIds,
  );
  const itens = itensRaw.map((it) => ({
    ca_id: it.ca_id as string,
    venda_ca_id: it.venda_ca_id as string,
    item_ca_id: (it.item_ca_id as string) ?? null,
    nome: (it.nome as string) ?? null,
    quantidade: Number(it.quantidade ?? 1),
    valor: Number(it.valor ?? 0),
  }));

  // ---- 2. Mapas ----------------------------------------------------------
  const mapaRaw = await lerTudo<Record<string, unknown>>(
    "ca_mapa_receita",
    "ca_tipo, ca_id, bu, product_line, conta_vendedor, ignorar",
  );
  const mapaCategoria = new Map<string, MapaLinha>();
  const mapaItem = new Map<string, MapaLinha>();
  for (const m of mapaRaw) {
    const linha: MapaLinha = {
      bu: (m.bu as string) ?? null,
      product_line: (m.product_line as string) ?? null,
      conta_vendedor: !!m.conta_vendedor,
      ignorar: !!m.ignorar,
    };
    (m.ca_tipo === "item" ? mapaItem : mapaCategoria).set(m.ca_id as string, linha);
  }

  const vendRaw = await lerTudo<Record<string, unknown>>(
    "ca_vendedores",
    "ca_vendedor_id, destino, seller_id",
    { ordenarPor: "ca_vendedor_id" },
  );
  const mapaVendedor = new Map<string, { destino: Destino; seller_id: string | null }>();
  for (const v of vendRaw)
    mapaVendedor.set(v.ca_vendedor_id as string, {
      destino: (v.destino as Destino) ?? "pendente",
      seller_id: (v.seller_id as string) ?? null,
    });

  // ---- 3. Classifica cada item -------------------------------------------
  const paraSales: Record<string, unknown>[] = [];
  const paraDireto: Record<string, unknown>[] = [];
  const paraGrupo: Record<string, unknown>[] = [];

  const porVenda = new Map<string, typeof itens>();
  for (const it of itens) {
    const lista = porVenda.get(it.venda_ca_id) ?? [];
    lista.push(it);
    porVenda.set(it.venda_ca_id, lista);
  }

  for (const v of vendas) {
    const vid = v.ca_id as string;
    const lista = porVenda.get(vid) ?? [];
    const vend = v.vendedor_ca_id ? mapaVendedor.get(v.vendedor_ca_id as string) : undefined;
    const destino: Destino = vend?.destino ?? "pendente";
    const catMapa = v.categoria_ca_id ? mapaCategoria.get(v.categoria_ca_id as string) : undefined;

    for (const it of lista) {
      // Item tem a palavra final quando classificado; categoria é a rede embaixo.
      const itMapa = it.item_ca_id ? mapaItem.get(it.item_ca_id) : undefined;
      const escolhido: MapaLinha | undefined =
        itMapa && !itMapa.ignorar && itMapa.product_line
          ? itMapa
          : itMapa?.ignorar
            ? itMapa
            : catMapa;

      if (!escolhido || escolhido.ignorar) {
        if (escolhido?.ignorar) r.ignorados++;
        else {
          r.pendentes++;
          r.valorPendente += it.valor;
        }
        continue;
      }
      if (!escolhido.product_line) {
        r.pendentes++;
        r.valorPendente += it.valor;
        continue;
      }

      const base = {
        sale_date: v.data as string,
        product_line: escolhido.product_line,
        valor: it.valor,
        quantidade: Math.max(1, Math.round(it.quantidade || 1)),
        origem: "conta_azul" as const,
        ca_venda_id: vid,
        ca_item_id: it.ca_id,
        ca_versao: (v.versao as number) ?? null,
      };

      // Não conta para vendedor (mensalidade, repasse, fardamento, livros,
      // eventos do Colégio): receita do GRUPO, fora de `sales` por desenho.
      if (!escolhido.conta_vendedor) {
        // Vale a linha do vendedor OU uma linha só-do-grupo (ver ./linhas.ts).
        // Sem esta checagem, um id digitado errado no mapa viraria uma linha
        // de receita inventada que ninguém reconhece no painel.
        if (!linhaValida(escolhido.product_line, false)) {
          r.linhaInvalida++;
          continue;
        }
        paraGrupo.push({
          ca_venda_id: vid,
          ca_item_id: it.ca_id,
          sale_date: base.sale_date,
          bu: escolhido.bu,
          product_line: escolhido.product_line,
          valor: it.valor,
          quantidade: it.quantidade || 1,
          conta_vendedor: false,
          cliente_ca_id: (v.cliente_ca_id as string) ?? null,
          vendedor_ca_id: (v.vendedor_ca_id as string) ?? null,
          ca_versao: (v.versao as number) ?? null,
        });
        continue;
      }

      // Daqui para baixo a linha CONTA para vendedor.
      if (!LINHAS_VENDEDOR.has(escolhido.product_line)) {
        // Linha desconhecida nunca entra em `sales`: `buFromProductLine()` a
        // mandaria para o CPPEM sem avisar ninguém.
        r.linhaInvalida++;
        continue;
      }

      if (destino === "vendedor" && vend?.seller_id) {
        paraSales.push({ ...base, seller_id: vend.seller_id });
        continue;
      }
      if (destino === "canal_direto") {
        paraDireto.push({ ...base, channel: "direto" });
        continue;
      }
      // 'grupo' e 'pendente': conta para vendedor, mas não há vendedor. É a
      // "venda sem dono" — fica visível em vez de sumir.
      r.semDono++;
      r.valorSemDono += it.valor;
      paraGrupo.push({
        ca_venda_id: vid,
        ca_item_id: it.ca_id,
        sale_date: base.sale_date,
        bu: escolhido.bu,
        product_line: escolhido.product_line,
        valor: it.valor,
        quantidade: it.quantidade || 1,
        conta_vendedor: true,
        cliente_ca_id: (v.cliente_ca_id as string) ?? null,
        vendedor_ca_id: (v.vendedor_ca_id as string) ?? null,
        ca_versao: (v.versao as number) ?? null,
      });
    }
  }

  // ---- 4. Troca a janela -------------------------------------------------
  // ⚠️ `.eq("origem", "conta_azul")` em TODOS os deletes. Sem ele, este bloco
  // apagaria o faturamento lançado à mão do mês inteiro.
  const limpar = async (tabela: "sales" | "direct_sales") => {
    const { error } = await supabaseAdmin
      .from(tabela)
      .delete()
      .eq("origem", "conta_azul")
      .gte("sale_date", de)
      .lte("sale_date", ate);
    if (error) throw new Error(`limpar ${tabela}: ${error.message}`);
  };
  await limpar("sales");
  await limpar("direct_sales");
  {
    const { error } = await supabaseAdmin.from("ca_receita").delete().gte("sale_date", de).lte("sale_date", ate);
    if (error) throw new Error(`limpar ca_receita: ${error.message}`);
  }

  const inserir = async (tabela: string, linhas: Record<string, unknown>[]) => {
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await supabaseAdmin.from(tabela).insert(linhas.slice(i, i + 500));
      if (error) throw new Error(`inserir ${tabela}: ${error.message}`);
    }
  };
  await inserir("sales", paraSales);
  await inserir("direct_sales", paraDireto);
  await inserir("ca_receita", paraGrupo);

  r.paraSales = paraSales.length;
  r.paraDireto = paraDireto.length;
  r.paraGrupo = paraGrupo.length;
  return r;
}
