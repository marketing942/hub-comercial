import { periodNow } from "@/lib/calc";
import { loadYear } from "@/lib/yearRealizado";
import { YEAR_MAX, YEAR_MIN } from "@/lib/yearMath";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import AnoClient from "./ano-client";

export const dynamic = "force-dynamic";

export default async function AnoPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const now = periodNow();
  const y = Number(searchParams.year);
  const year = Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX ? y : now.year;
  const { grid, tableMissing } = await loadYear(year);

  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Ano</h1>
        <p className="text-sm text-white/50">
          Realizado total de cada mes, por BU. Os valores sao digitados aqui e salvos sozinhos.
        </p>
      </div>
      {tableMissing && (
        <div className="panel p-4 text-sm" style={{ borderColor: "rgba(240,180,76,0.45)" }}>
          <div className="eyebrow-label" style={{ color: "#f0b44c" }}>Tabela ainda nao criada</div>
          <p className="mt-1.5 text-white/70">
            Rode o arquivo <b>supabase/migrate-realizado-ano.sql</b> no SQL Editor do Supabase.
            Ele cria a tabela e traz os dados do painel antigo. Enquanto isso, a aba abre vazia e
            nao consegue salvar.
          </p>
        </div>
      )}
      <AnoClient key={year} year={year} initialGrid={grid} disabled={tableMissing} />
    </div>
  );
}
