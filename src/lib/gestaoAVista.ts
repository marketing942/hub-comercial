/**
 * Gestao a Vista — o faturamento da EMPRESA no mes, todas as linhas de receita
 * do Conta Azul, de uma vez.
 *
 * ## De onde vem cada pedaco
 *
 * O espelho do Conta Azul cai em tres tabelas (ver `src/lib/ca/normaliza.ts`),
 * e cada uma e uma das tres origens que a tela separa:
 *
 *  - `sales`         -> VENDEDORES (venda creditada a alguem do Hub)
 *  - `direct_sales`  -> DIRETO (canal direto/site, sem vendedor)
 *  - `ca_receita`    -> DIRETORIA / GRUPO (mensalidade, repasse, eventos do
 *                       Colegio e o que foi lancado por diretoria/administrativo)
 *
 * Somando as tres sai o faturamento total da empresa. A soma e feita aqui, nao
 * nas telas: dali para dentro `valor` quer dizer uma coisa so (total da linha).
 *
 * ## Nada do Conta Azul fica de fora
 *
 * Item que o Conta Azul tem e que ainda nao foi classificado (ver "Classificacao"
 * em Configuracoes) nao esta em nenhuma das tres tabelas. Mesmo assim e receita
 * da empresa, entao entra aqui como `pendente` ("Sem classificacao"), com a
 * categoria do Conta Azul no nome — o total da empresa fecha com o do Conta Azul
 * e o que falta classificar fica visivel, nunca invisivel. So fica de fora o que
 * foi marcado "ignorar" (frete, multa, estorno) e venda cancelada.
 *
 * ## Categoria de receita
 *
 * As 12 series do Colegio sao UMA categoria aqui ("Matriculas do Colegio"): a
 * serie serve para meta e dashboard por turma, nao para ler o faturamento.
 *
 * Todas as leituras filtram `origem = 'conta_azul'`: lancamento a mao antigo
 * nao entra, e a tela nao depende de `FONTE_PADRAO`.
 */
import { unstable_cache } from "next/cache";

import { DASHBOARD_TAG, supabaseAdmin } from "./supabase";
import { fetchAll } from "./data";
import { situacaoConta } from "./ca/config";
import { lerPorChaves, lerTudo } from "./ca/ler";
import { LINHAS_VENDEDOR, ROTULOS_GRUPO } from "./ca/linhas";
import { COLEGIO_MATRICULAS_IDS, buFromProductLine, productLabel } from "./products";
import { nowRecife } from "./calc";
import {
  vazioBu,
  vazioOrigem,
  type BuKey,
  type DiaGestao,
  type GestaoMes,
  type LinhaCategoria,
  type Origem,
} from "./gestaoAVistaTipos";

type Linha = { sale_date: string; product_line: string; valor: number | null };
type LinhaGrupo = Linha & { bu: string | null; conta_vendedor: boolean | null };

const MATRICULAS_COLEGIO = new Set<string>(COLEGIO_MATRICULAS_IDS as readonly string[]);
/** BU das linhas so-do-grupo, para quando a linha gravada veio sem BU. */
const BU_DO_GRUPO: Record<string, BuKey> = {
  repasse_unicive: "unicive",
  mensalidade_colegio: "colegio_cppem",
  eventos_colegio: "colegio_cppem",
  reforco_colegio: "colegio_cppem",
  livros_colegio: "colegio_cppem",
};
const BUS_VALIDAS = new Set<string>(["cppem", "unicive", "colegio_cppem"]);

/** Linha de receita -> categoria de receita exibida (as series do Colegio viram uma). */
function categoriaDe(linha: string): { chave: string; rotulo: string } {
  if (MATRICULAS_COLEGIO.has(linha)) return { chave: "colegio_matriculas", rotulo: "Matrículas do Colégio" };
  return { chave: linha, rotulo: ROTULOS_GRUPO[linha] ?? productLabel(linha) };
}

function buDaLinha(linha: string, buGravada: string | null): BuKey {
  if (LINHAS_VENDEDOR.has(linha)) return buFromProductLine(linha);
  if (buGravada && BUS_VALIDAS.has(buGravada)) return buGravada as BuKey;
  return BU_DO_GRUPO[linha] ?? "grupo";
}

type Pendente = { data: string; valor: number; categoria: string };

/**
 * Itens do Conta Azul do mes que contam como faturamento mas ainda nao tem linha
 * de receita. Mesma precedencia da normalizacao (item antes de categoria, ver
 * `src/lib/ca/normaliza.ts`) — so que aqui o resultado e "tem linha ou nao".
 */
async function lerPendentes(de: string, prox: string): Promise<Pendente[]> {
  const vendasRaw = await lerTudo<{ ca_id: string; data: string; situacao: string | null; categoria_ca_id: string | null }>(
    "ca_vendas",
    "ca_id, data, situacao, categoria_ca_id",
    { filtrar: (q) => (q as never as { gte: Function; lt: Function }).gte("data", de).lt("data", prox) },
  );
  const vendas = vendasRaw.filter((v) => situacaoConta(v.situacao));
  if (vendas.length === 0) return [];

  const [itens, mapaRaw] = await Promise.all([
    lerPorChaves<{ venda_ca_id: string; item_ca_id: string | null; quantidade: number | null; valor: number | null }>(
      "ca_venda_itens",
      "ca_id, venda_ca_id, item_ca_id, quantidade, valor",
      "venda_ca_id",
      vendas.map((v) => v.ca_id),
    ),
    lerTudo<{ ca_tipo: string; ca_id: string; ca_nome: string | null; product_line: string | null; ignorar: boolean | null }>(
      "ca_mapa_receita",
      "ca_tipo, ca_id, ca_nome, product_line, ignorar",
      { ordenarPor: "ca_id" },
    ),
  ]);

  const mapaItem = new Map<string, (typeof mapaRaw)[number]>();
  const mapaCat = new Map<string, (typeof mapaRaw)[number]>();
  for (const m of mapaRaw) (m.ca_tipo === "item" ? mapaItem : mapaCat).set(m.ca_id, m);
  const vendaPorId = new Map(vendas.map((v) => [v.ca_id, v]));

  const out: Pendente[] = [];
  for (const it of itens) {
    const v = vendaPorId.get(it.venda_ca_id);
    if (!v) continue;
    const itMapa = it.item_ca_id ? mapaItem.get(it.item_ca_id) : undefined;
    const catMapa = v.categoria_ca_id ? mapaCat.get(v.categoria_ca_id) : undefined;
    const escolhido = itMapa && !itMapa.ignorar && itMapa.product_line ? itMapa : itMapa?.ignorar ? itMapa : catMapa;
    if (escolhido?.ignorar) continue;
    if (escolhido?.product_line) continue; // classificado: ja esta em sales/direct_sales/ca_receita
    const qtd = Math.max(1, Math.round(Number(it.quantidade ?? 1)));
    out.push({
      data: v.data,
      valor: Number(it.valor ?? 0) * qtd,
      categoria: catMapa?.ca_nome || (v.categoria_ca_id ? "categoria sem nome" : "sem categoria no Conta Azul"),
    });
  }
  return out;
}

async function calcular(year: number, mes: number): Promise<GestaoMes> {
  const mm = String(mes).padStart(2, "0");
  const de = `${year}-${mm}-01`;
  const prox = mes === 12 ? `${year + 1}-01-01` : `${year}-${String(mes + 1).padStart(2, "0")}-01`;
  const totalDias = new Date(year, mes, 0).getDate();

  const [vendedores, direto, grupo, pendentes, sync] = await Promise.all([
    fetchAll<Linha>("gestao(sales)", () =>
      supabaseAdmin
        .from("sales")
        .select("sale_date, product_line, valor")
        .eq("origem", "conta_azul")
        .gte("sale_date", de)
        .lt("sale_date", prox)
        .order("id"),
    ),
    fetchAll<Linha>("gestao(direct_sales)", () =>
      supabaseAdmin
        .from("direct_sales")
        .select("sale_date, product_line, valor")
        .eq("origem", "conta_azul")
        .gte("sale_date", de)
        .lt("sale_date", prox)
        .order("id"),
    ),
    fetchAll<LinhaGrupo>("gestao(ca_receita)", () =>
      supabaseAdmin
        .from("ca_receita")
        .select("sale_date, product_line, valor, bu, conta_vendedor")
        .gte("sale_date", de)
        .lt("sale_date", prox)
        .order("ca_venda_id")
        .order("ca_item_id"),
    ),
    lerPendentes(de, prox).catch(() => [] as Pendente[]),
    (async () => {
      try {
        const { data } = await supabaseAdmin
          .from("ca_sync")
          .select("concluido_em, erro")
          .eq("recurso", "vendas")
          .maybeSingle();
        return (data as { concluido_em: string | null; erro: string | null } | null) ?? null;
      } catch {
        return null;
      }
    })(),
  ]);

  const dias: DiaGestao[] = Array.from({ length: totalDias }, (_, i) => ({
    dia: i + 1,
    data: `${year}-${mm}-${String(i + 1).padStart(2, "0")}`,
    total: 0,
    origem: vazioOrigem(),
    bu: vazioBu(),
    categoria: {},
    acumulado: null,
  }));
  const porOrigem = vazioOrigem();
  let semDono = 0;
  const cats = new Map<string, LinhaCategoria>();

  const somar = (origem: Origem, data: string, bu: BuKey, cat: { chave: string; rotulo: string }, valor: number) => {
    const d = Number(data.slice(8, 10));
    if (d >= 1 && d <= totalDias) {
      const dia = dias[d - 1];
      dia.total += valor;
      dia.origem[origem] += valor;
      dia.bu[bu] += valor;
      dia.categoria[cat.chave] = (dia.categoria[cat.chave] ?? 0) + valor;
    }
    porOrigem[origem] += valor;
    let c = cats.get(cat.chave);
    if (!c) {
      c = { chave: cat.chave, rotulo: cat.rotulo, bu, valor: 0, origem: vazioOrigem() };
      cats.set(cat.chave, c);
    }
    c.valor += valor;
    c.origem[origem] += valor;
  };

  for (const l of vendedores) somar("vendedores", l.sale_date, buDaLinha(l.product_line, null), categoriaDe(l.product_line), Number(l.valor ?? 0));
  for (const l of direto) somar("direto", l.sale_date, buDaLinha(l.product_line, null), categoriaDe(l.product_line), Number(l.valor ?? 0));
  for (const l of grupo) {
    const v = Number(l.valor ?? 0);
    somar("diretoria", l.sale_date, buDaLinha(l.product_line, l.bu), categoriaDe(l.product_line), v);
    if (l.conta_vendedor) semDono += v;
  }
  for (const p of pendentes) {
    somar("pendente", p.data, "pendente", { chave: `pend:${p.categoria}`, rotulo: p.categoria }, p.valor);
  }

  // Acumulado: para no dia de hoje se o mes e o corrente (dia futuro nao tem dado).
  const hoje = nowRecife();
  const ehCorrente = hoje.getFullYear() === year && hoje.getMonth() + 1 === mes;
  const ate = ehCorrente ? hoje.getDate() : totalDias;
  let corrente = 0;
  for (const d of dias) {
    corrente += d.total;
    d.acumulado = d.dia <= ate ? corrente : null;
  }

  return {
    year,
    mes,
    total: ORIGENS_SOMA.reduce((s, o) => s + porOrigem[o], 0),
    porOrigem,
    semDono,
    dias,
    categorias: [...cats.values()].filter((c) => c.valor !== 0).sort((a, b) => b.valor - a.valor),
    sync: { em: sync?.concluido_em ?? null, erro: sync?.erro ?? null },
  };
}

const ORIGENS_SOMA: Origem[] = ["vendedores", "direto", "diretoria", "pendente"];

/**
 * Com cache de servidor: o mes corrente recebe venda a cada sync (15 min) e cai
 * junto com o resto do dashboard (`DASHBOARD_TAG`); mes fechado quase nao muda e
 * fica fora da tag, para a venda de hoje nao jogar fora o cache dele.
 */
export function gestaoDoMes(year: number, mes: number): Promise<GestaoMes> {
  const hoje = nowRecife();
  const ehCorrente = year > hoje.getFullYear() || (year === hoje.getFullYear() && mes >= hoje.getMonth() + 1);
  return unstable_cache(
    () => calcular(year, mes),
    [`gestao-a-vista-v2-${year}-${mes}`],
    ehCorrente ? { revalidate: 600, tags: [DASHBOARD_TAG] } : { revalidate: 3600 },
  )();
}
