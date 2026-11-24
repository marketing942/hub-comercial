/**
 * Metas por linha de receita = categoria do Conta Azul (etapa 2).
 *
 * A meta de cada BU e dividida pelas categorias que o PROPRIO Conta Azul tem —
 * sem ligar a "linha do Hub". Realizado vem de `ca_linha_receita`; a meta, de
 * `ca_metas_linha`. Tudo degrada para vazio se as tabelas ainda nao existem.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { fetchAll } from "@/lib/data";
import { COLEGIO_MATRICULAS_IDS, type BU } from "@/lib/products";
import { lerTudo } from "./ler";
import { normalizar, palpitarCategoria } from "./sugestao";
import type { CategoriaCA, CategoriaMeta } from "./metasLinhaTipos";

function intervalo(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const prox = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { de: `${year}-${mm}-01`, prox };
}

/** Categorias do Conta Azul que pertencem a esta BU (mapa, ou o palpite pelo nome). */
export async function categoriasDaBu(bu: BU): Promise<{ id: string; nome: string }[]> {
  const rows = await lerTudo<{ ca_id: string; ca_nome: string | null; bu: string | null; ignorar: boolean | null }>(
    "ca_mapa_receita",
    "ca_id, ca_nome, bu, ignorar",
    { filtrar: (q) => (q as never as { eq: Function }).eq("ca_tipo", "categoria") },
  );
  const out: { id: string; nome: string }[] = [];
  for (const r of rows) {
    const palpite = !r.bu && !r.ignorar ? palpitarCategoria(r.ca_nome) : null;
    const ignora = r.ignorar || !!palpite?.ignorar;
    const buEfetiva = r.bu || palpite?.bu || null;
    if (ignora || buEfetiva !== bu) continue;
    out.push({ id: r.ca_id, nome: r.ca_nome || `Categoria ${r.ca_id.slice(0, 8)}` });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Realizado do mes por categoria, de uma BU (todas as origens). */
export async function realizadoPorCategoria(bu: BU, year: number, month: number) {
  const { de, prox } = intervalo(year, month);
  const acc = new Map<string, { valor: number; qtd: number }>();
  try {
    const linhas = await fetchAll<{ categoria_id: string | null; valor: number | null; quantidade: number | null }>(
      "metasLinha(realizado)",
      () =>
        supabaseAdmin
          .from("ca_linha_receita")
          .select("categoria_id, valor, quantidade")
          .eq("bu", bu)
          .gte("sale_date", de)
          .lt("sale_date", prox)
          .order("ca_venda_id")
          .order("ca_item_id"),
      true,
    );
    for (const l of linhas) {
      if (!l.categoria_id) continue;
      const a = acc.get(l.categoria_id) ?? { valor: 0, qtd: 0 };
      a.valor += Number(l.valor ?? 0);
      a.qtd += Number(l.quantidade ?? 0);
      acc.set(l.categoria_id, a);
    }
  } catch {
    /* tabela ainda nao existe */
  }
  return acc;
}

/** Metas gravadas (por categoria) de uma BU/mes. `null` = tabela ausente. */
export async function metasGravadas(bu: BU, year: number, month: number) {
  const { data, error } = await supabaseAdmin
    .from("ca_metas_linha")
    .select("categoria_id, valor_meta, quantidade_meta")
    .eq("bu", bu)
    .eq("year", year)
    .eq("month", month);
  if (error) return null;
  return new Map(
    ((data as { categoria_id: string; valor_meta: number; quantidade_meta: number }[]) ?? []).map((r) => [
      r.categoria_id,
      { valor: Number(r.valor_meta ?? 0), qtd: Number(r.quantidade_meta ?? 0) },
    ]),
  );
}

/**
 * Converte as metas ANTIGAS (por linha do Hub) para as categorias do Conta Azul:
 * linha com categoria equivalente leva a meta; as 12 series do Colegio somam na
 * categoria de matricula. E so uma sugestao — a tela mostra para revisar.
 */
async function metasAntigas(bu: BU, year: number, month: number, cats: { id: string; nome: string }[]) {
  const { data } = await supabaseAdmin
    .from("bu_product_goals")
    .select("product_line, valor_meta, quantidade_meta")
    .eq("bu", bu)
    .eq("year", year)
    .eq("month", month);
  const porLinha = new Map(
    ((data as { product_line: string; valor_meta: number; quantidade_meta: number }[]) ?? []).map((r) => [
      r.product_line,
      { valor: Number(r.valor_meta ?? 0), qtd: Number(r.quantidade_meta ?? 0) },
    ]),
  );
  const out = new Map<string, { valor: number; qtd: number }>();
  for (const c of cats) {
    const p = palpitarCategoria(c.nome);
    if (!p) continue;
    if (p.product_line && porLinha.has(p.product_line)) {
      out.set(c.id, porLinha.get(p.product_line)!);
    } else if (bu === "colegio_cppem" && !p.product_line && p.conta_vendedor && /MATRICULA/.test(normalizar(c.nome).toUpperCase())) {
      let valor = 0;
      let qtd = 0;
      for (const id of COLEGIO_MATRICULAS_IDS as readonly string[]) {
        const g = porLinha.get(id);
        if (g) {
          valor += g.valor;
          qtd += g.qtd;
        }
      }
      if (valor || qtd) out.set(c.id, { valor, qtd });
    }
  }
  return out;
}

/** Tudo da tela de metas por linha. */
export async function montarMetasLinha(bu: BU, year: number, month: number) {
  const cats = await categoriasDaBu(bu);
  const [real, gravadas, antigas] = await Promise.all([
    realizadoPorCategoria(bu, year, month),
    metasGravadas(bu, year, month),
    metasAntigas(bu, year, month, cats).catch(() => new Map<string, { valor: number; qtd: number }>()),
  ]);
  const categorias: CategoriaMeta[] = cats.map((c) => ({
    id: c.id,
    nome: c.nome,
    realizado: real.get(c.id)?.valor ?? 0,
    qtd: real.get(c.id)?.qtd ?? 0,
    meta_valor: gravadas?.get(c.id)?.valor ?? 0,
    meta_qtd: gravadas?.get(c.id)?.qtd ?? 0,
    antiga_valor: antigas.get(c.id)?.valor ?? 0,
    antiga_qtd: antigas.get(c.id)?.qtd ?? 0,
  }));
  return { categorias, semTabela: gravadas === null };
}

/** Categorias de uma BU com realizado x meta — para o dashboard. Vazio se nao ha dado. */
export async function categoriasParaDashboard(bu: BU, year: number, month: number): Promise<CategoriaCA[]> {
  try {
    const cats = await categoriasDaBu(bu);
    const [real, gravadas] = await Promise.all([realizadoPorCategoria(bu, year, month), metasGravadas(bu, year, month)]);
    return cats
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        valor: real.get(c.id)?.valor ?? 0,
        qtd: real.get(c.id)?.qtd ?? 0,
        meta_valor: gravadas?.get(c.id)?.valor ?? 0,
        meta_qtd: gravadas?.get(c.id)?.qtd ?? 0,
      }))
      .filter((c) => c.valor > 0 || c.meta_valor > 0 || c.meta_qtd > 0 || c.qtd > 0)
      .sort((a, b) => b.valor - a.valor);
  } catch {
    return [];
  }
}
