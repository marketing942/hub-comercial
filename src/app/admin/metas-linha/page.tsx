import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import { periodNow } from "@/lib/calc";
import MetasLinhaClient from "./metas-linha-client";

export const dynamic = "force-dynamic";

export default function MetasLinhaPage() {
  const { year, month } = periodNow();
  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Metas por linha de receita</h1>
        <p className="text-sm text-white/50">
          Uma meta para cada categoria do Conta Azul, em cada BU. Sem ligar nada a &quot;linha do Hub&quot;.
        </p>
      </div>
      <MetasLinhaClient defaultYear={year} defaultMonth={month} />
    </div>
  );
}
