import PainelDashboard from "@/components/PainelDashboard";
import { FONTE_PADRAO } from "@/lib/fonte";
import { parseYearMonth } from "@/lib/periodo";

export const dynamic = "force-dynamic";

/**
 * Dashboard TV. O corpo foi para `components/PainelDashboard.tsx` quando o GAV
 * nasceu (ver `src/lib/fonte.ts`): as duas rotas usam o MESMO caminho de dados e
 * a mesma montagem de slides, e só a origem muda.
 *
 * Esta tela lê `FONTE_PADRAO`. O cutover é trocar aquela constante — aqui não
 * muda nada.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const { year, month } = parseYearMonth(searchParams);
  return <PainelDashboard year={year} month={month} fonte={FONTE_PADRAO} />;
}
