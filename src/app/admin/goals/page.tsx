import { listSellers } from "@/lib/data";
import { periodNow } from "@/lib/calc";
import { listLongTermGoals } from "@/lib/longTerm";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import GoalsClient from "./goals-client";
import LongTermGoalsEditor from "./LongTermGoalsEditor";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [sellers, longTermGoals] = await Promise.all([
    listSellers({ onlyActive: true }),
    listLongTermGoals(),
  ]);
  const { year, month } = periodNow();
  return (
    <div className="space-y-6">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Metas do mes</h1>
        <p className="text-sm text-white/50">
          Escolha a BU e o mês. Três níveis, nesta ordem: meta total da BU, meta por linha de receita e meta por vendedor. Um botão salva tudo.
        </p>
      </div>
      <GoalsClient sellers={sellers} defaultYear={year} defaultMonth={month} />
      <LongTermGoalsEditor initial={longTermGoals} />
    </div>
  );
}
