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
 * Item ainda sem classificacao NAO esta em nenhuma das tres (ver
 * "Classificacao" em Configuracoes) — a tela avisa no rodape.
 *
 * Todas as leituras filtram `origem = 'conta_azul'`: lancamento a mao antigo
 * nao entra, e a tela nao depende de `FONTE_PADRAO`.
 */
import { unstable_cache } from "next/cache";

import { DASHBOARD_TAG, supabaseAdmin } from "./supabase";
import { fetchAll } from "./data";
import { ROTULOS_GRUPO, LINHAS_VENDEDOR } from "./ca/linhas";
import { buFromProductLine, productLabel, type BU } from "./products";
import { nowRecife } from "./calc";
import type { DiaGestao, GestaoMes, LinhaCategoria, Origem } from "./gestaoAVistaTipos";

type Linha = { sale_date: string; product_line: string; valor: number | null };
type LinhaGrupo = Linha & { bu: string | null; conta_vendedor: boolean | null };

const BUS_VALIDAS = new Set<string>(["cppem", "unicive", "colegio_cppem"]);

async function calcular(year: number, mes: number): Promise<GestaoMes> {
  const mm = String(mes).padStart(2, "0");
  const de = `${year}-${mm}-01`;
  const prox = mes === 12 ? `${year + 1}-01-01` : `${year}-${String(mes + 1).padStart(2, "0")}-01`;
  const totalDias = new Date(year, mes, 0).getDate();

  const [vendedores, direto, grupo, sync] = await Promise.all([
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
    vendedores: 0,
    direto: 0,
    diretoria: 0,
    total: 0,
    acumulado: null,
  }));
  const porOrigem: Record<Origem, number> = { vendedores: 0, direto: 0, diretoria: 0 };
  let semDono = 0;
  const cats = new Map<string, LinhaCategoria>();

  const somar = (origem: Origem, l: Linha, buDaLinha: string | null) => {
    const v = Number(l.valor ?? 0);
    const d = Number(l.sale_date.slice(8, 10));
    if (d >= 1 && d <= totalDias) {
      dias[d - 1][origem] += v;
      dias[d - 1].total += v;
    }
    porOrigem[origem] += v;

    const chave = l.product_line;
    let c = cats.get(chave);
    if (!c) {
      // Linha de vendedor tem BU pela propria linha; as so-do-grupo, pela BU gravada.
      const bu: BU | "grupo" = LINHAS_VENDEDOR.has(chave)
        ? buFromProductLine(chave)
        : buDaLinha && BUS_VALIDAS.has(buDaLinha)
          ? (buDaLinha as BU)
          : "grupo";
      c = {
        chave,
        rotulo: ROTULOS_GRUPO[chave] ?? productLabel(chave),
        bu,
        valor: 0,
        vendedores: 0,
        direto: 0,
        diretoria: 0,
      };
      cats.set(chave, c);
    }
    c.valor += v;
    c[origem] += v;
  };

  for (const l of vendedores) somar("vendedores", l, null);
  for (const l of direto) somar("direto", l, null);
  for (const l of grupo) {
    somar("diretoria", l, l.bu);
    if (l.conta_vendedor) semDono += Number(l.valor ?? 0);
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
    total: porOrigem.vendedores + porOrigem.direto + porOrigem.diretoria,
    porOrigem,
    semDono,
    dias,
    categorias: [...cats.values()].filter((c) => c.valor !== 0).sort((a, b) => b.valor - a.valor),
    sync: { em: sync?.concluido_em ?? null, erro: sync?.erro ?? null },
  };
}

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
    [`gestao-a-vista-v1-${year}-${mes}`],
    ehCorrente ? { revalidate: 600, tags: [DASHBOARD_TAG] } : { revalidate: 3600 },
  )();
}
