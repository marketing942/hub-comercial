import { supabaseAdmin } from "@/lib/supabase";

/**
 * Lê uma tabela inteira, paginando.
 *
 * ## Por que isto existe
 *
 * `.limit(20000)` **não** levanta o teto: o PostgREST corta em 1.000 linhas e
 * não avisa — devolve 1.000 e segue como se fosse tudo. Em 11/11/2026 a
 * normalização lia `ca_vendas` com `.limit(20000)`, recebia 1.000 de 1.546 e
 * perdia **35% do faturamento em silêncio**. O resultado continuava plausível,
 * que é o que torna esse bug caro.
 *
 * `fetchAll` em `src/lib/data.ts` já resolve isso para as tabelas antigas. Esta
 * é a mesma ideia para o módulo do Conta Azul, com a ordenação explícita que
 * falta lá: paginar por offset sem `order` não garante que a página 2 continue
 * de onde a 1 parou — o Postgres não promete ordem estável entre consultas.
 */
const PAGINA = 1000;

export async function lerTudo<T>(
  tabela: string,
  colunas: string,
  opts?: {
    /** Ordenação de desempate. Padrão: a chave textual mais comum do módulo. */
    ordenarPor?: string;
    filtrar?: (q: ReturnType<ReturnType<typeof supabaseAdmin.from>["select"]>) => unknown;
  },
): Promise<T[]> {
  const ordem = opts?.ordenarPor ?? "ca_id";
  const out: T[] = [];
  for (let from = 0; ; from += PAGINA) {
    let q = supabaseAdmin.from(tabela).select(colunas);
    if (opts?.filtrar) q = opts.filtrar(q as never) as typeof q;
    const { data, error } = await (q as unknown as {
      order: (c: string, o: { ascending: boolean }) => {
        range: (a: number, b: number) => Promise<{ data: T[] | null; error: { message: string } | null }>;
      };
    })
      .order(ordem, { ascending: true })
      .range(from, from + PAGINA - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const lote = data ?? [];
    out.push(...lote);
    if (lote.length < PAGINA) break;
    // Trava contra laço infinito se a paginação parar de avançar.
    if (from > 500_000) break;
  }
  return out;
}

/**
 * Lê por lotes de `in(...)`, paginando cada lote.
 *
 * Um `in()` com 300 chaves ainda pode devolver mais de 1.000 linhas quando há
 * vários registros por chave — e aí o corte volta pela porta dos fundos.
 */
export async function lerPorChaves<T>(
  tabela: string,
  colunas: string,
  coluna: string,
  chaves: string[],
  opts?: { ordenarPor?: string; tamanhoLote?: number },
): Promise<T[]> {
  const lote = opts?.tamanhoLote ?? 300;
  const out: T[] = [];
  for (let i = 0; i < chaves.length; i += lote) {
    const fatia = chaves.slice(i, i + lote);
    const parcial = await lerTudo<T>(tabela, colunas, {
      ordenarPor: opts?.ordenarPor,
      filtrar: (q) => (q as never as { in: (c: string, v: string[]) => unknown }).in(coluna, fatia),
    });
    out.push(...parcial);
  }
  return out;
}
