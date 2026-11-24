/**
 * Gestao a Vista — o faturamento da EMPRESA no mes, todas as linhas de receita
 * do Conta Azul.
 *
 * ## Uma fonte so: a categoria do Conta Azul
 *
 * Cada item valido do Conta Azul e UMA linha em `ca_linha_receita` (gravada pela
 * normalizacao, ver `src/lib/ca/normaliza.ts`), com a categoria do PROPRIO Conta
 * Azul, a BU e a origem. Esta tela le so essa tabela — nao depende de ninguem ter
 * ligado item a "linha do Hub", e por isso nao perde receita: o total fecha com o
 * do Conta Azul (so ficam de fora venda cancelada e o que foi marcado "ignorar").
 *
 * ## As 3 origens
 *
 *  - vendedores: conta p/ vendedor E o vendedor do Conta Azul esta ligado a um
 *    vendedor do Hub (ou a BU tem um vendedor so)
 *  - direto:     conta p/ vendedor mas a venda e do canal direto (site)
 *  - diretoria:  nao conta p/ vendedor (mensalidade, repasse, fardamento, livros...)
 *                ou conta mas chegou sem dono
 * A classificacao de VENDEDORES (Configuracoes > Classificacao) continua sendo o
 * que separa as tres.
 */
import { unstable_cache } from "next/cache";

import { DASHBOARD_TAG, supabaseAdmin } from "./supabase";
import { fetchAll } from "./data";
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

type Linha = {
  sale_date: string;
  valor: number | null;
  categoria_id: string | null;
  categoria_nome: string;
  bu: string | null;
  origem: Origem;
  sem_dono: boolean | null;
};

const BUS_VALIDAS = new Set<string>(["cppem", "unicive", "colegio_cppem"]);

async function calcular(year: number, mes: number): Promise<GestaoMes> {
  const mm = String(mes).padStart(2, "0");
  const de = `${year}-${mm}-01`;
  const prox = mes === 12 ? `${year + 1}-01-01` : `${year}-${String(mes + 1).padStart(2, "0")}-01`;
  const totalDias = new Date(year, mes, 0).getDate();

  let semTabela = false;
  const [linhas, metas, sync] = await Promise.all([
    (async () => {
      try {
        return await fetchAll<Linha>(
          "gestao(ca_linha_receita)",
          () =>
            supabaseAdmin
              .from("ca_linha_receita")
              .select("sale_date, valor, categoria_id, categoria_nome, bu, origem, sem_dono")
              .gte("sale_date", de)
              .lt("sale_date", prox)
              .order("ca_venda_id")
              .order("ca_item_id"),
          true,
        );
      } catch {
        semTabela = true;
        return [] as Linha[];
      }
    })(),
    (async () => {
      // Metas por linha (etapa 2): somadas por categoria; sem a tabela, sem metas.
      const m = new Map<string, number>();
      try {
        const { data } = await supabaseAdmin.from("ca_metas_linha").select("categoria_id, valor_meta").eq("year", year).eq("month", mes);
        for (const r of (data as { categoria_id: string; valor_meta: number }[]) ?? []) {
          m.set(r.categoria_id, (m.get(r.categoria_id) ?? 0) + Number(r.valor_meta ?? 0));
        }
      } catch {
        /* sem metas */
      }
      return m;
    })(),
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

  for (const l of linhas) {
    const v = Number(l.valor ?? 0);
    const bu: BuKey = l.bu && BUS_VALIDAS.has(l.bu) ? (l.bu as BuKey) : "grupo";
    // A categoria e a do Conta Azul; o nome identifica (o id pode faltar).
    const chave = l.categoria_id ?? `nome:${l.categoria_nome}`;
    const d = Number(l.sale_date.slice(8, 10));
    if (d >= 1 && d <= totalDias) {
      const dia = dias[d - 1];
      dia.total += v;
      dia.origem[l.origem] += v;
      dia.bu[bu] += v;
      dia.categoria[chave] = (dia.categoria[chave] ?? 0) + v;
    }
    porOrigem[l.origem] += v;
    if (l.sem_dono) semDono += v;
    let c = cats.get(chave);
    if (!c) {
      c = { chave, rotulo: l.categoria_nome, bu, valor: 0, origem: vazioOrigem(), metaValor: metas.get(chave) ?? 0 };
      cats.set(chave, c);
    }
    c.valor += v;
    c.origem[l.origem] += v;
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
    semTabela,
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
    [`gestao-a-vista-v3-${year}-${mes}`],
    ehCorrente ? { revalidate: 600, tags: [DASHBOARD_TAG] } : { revalidate: 3600 },
  )();
}
