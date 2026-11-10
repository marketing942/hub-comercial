import { periodNow } from "./data";

/**
 * Lê `?year=&month=` da URL, caindo no período atual quando vier ausente ou
 * inválido.
 *
 * Vive aqui, e não dentro de uma `page.tsx`, porque o App Router do Next
 * **proíbe** export arbitrário em arquivo de rota: ele valida que uma página só
 * exporte `default`, `metadata`, `dynamic` e os poucos nomes que conhece. A
 * primeira versão exportava esta função de `dashboard/page.tsx` e o `next build`
 * recusou com "Property 'parseYearMonth' is incompatible with index signature".
 */
export function parseYearMonth(searchParams: { year?: string; month?: string }) {
  const now = periodNow();
  const y = Number(searchParams.year);
  const m = Number(searchParams.month);
  const year = y >= 2024 && y <= 2100 ? y : now.year;
  const month = m >= 1 && m <= 12 ? m : now.month;
  return { year, month };
}
