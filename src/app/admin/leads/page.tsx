import { listSellers } from "@/lib/data";
import { periodNow } from "@/lib/calc";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import LeadsClient from "./leads-client";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const sellers = await listSellers({ onlyActive: true });
  const { year, month } = periodNow();
  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Leads recebidos</h1>
        <p className="text-sm text-white/50">
          Informe o total de leads que cada vendedor recebeu no mes ate agora. Alimenta a conversao, o pace e a projecao de leads.
        </p>
      </div>
      <LeadsClient sellers={sellers} defaultYear={year} defaultMonth={month} />
    </div>
  );
}
