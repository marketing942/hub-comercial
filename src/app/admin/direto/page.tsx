import { periodNow } from "@/lib/calc";
import { directMonthRaw } from "@/lib/data";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import DiretoClient from "./direto-client";

export const dynamic = "force-dynamic";

export default async function DiretoAdminPage() {
  const { year, month } = periodNow();
  // Dados do mes ja vao no HTML: a tela nao abre vazia e espera 2 chamadas de API.
  const initial = await directMonthRaw(year, month);
  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Direto / IA</h1>
        <p className="text-sm text-white/50">
          Lance as vendas do site (direto) e as vendas fechadas pelas IAs de
          atendimento (podem ser CPPEM ou UNICIVE). Todas contam nas metas
          coletivas da BU. Atualize tambem as visitas diarias do site.
        </p>
      </div>
      <DiretoClient defaultYear={year} defaultMonth={month} initialSales={initial.sales} initialVisits={initial.visits} />
    </div>
  );
}
