import type { DirectSnapshot, LigacaoRow, IndicacaoRow } from "@/lib/data";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import { LIGACAO_STATUSES, INDICACAO_STATUSES } from "@/lib/products";
import BigStatCard from "@/components/BigStatCard";
import ProductRevenueBreakdown from "@/components/ProductRevenueBreakdown";
import OriginDonut from "@/components/OriginDonut";


export default function DirectDashboardView({
  snap,
  day,
  totalDays,
  daysLeft,
  monthName,
  ligacao,
  indicacao,
}: {
  snap: DirectSnapshot;
  day: number;
  totalDays: number;
  daysLeft: number;
  monthName: string;
  ligacao?: LigacaoRow[];
  indicacao?: IndicacaoRow[];
}) {
  const t = snap.totals;
  const hasUnicive = (t.valorUnicive || 0) > 0 || (snap.breakdownUnicive || []).some((r) => r.valor > 0);

  return (
    <div
      className="space-y-3 rounded-2xl p-3 -m-1 relative overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(900px 320px at 15% 0%, rgba(6,182,212,0.16), transparent 60%), radial-gradient(700px 280px at 90% 8%, rgba(167,139,250,0.14), transparent 60%)",
      }}
    >
      {/* Header — compacto, so titulo centralizado */}
      <div
        className="rounded-xl py-2 px-3 border border-white/5 text-center"
        style={{
          backgroundImage:
            "linear-gradient(120deg, rgba(6,182,212,0.20), rgba(167,139,250,0.16), rgba(10,25,32,0.55))",
        }}
      >
        <h2 className="text-lg xl:text-xl font-bold tracking-tight">
          Dashboard Direto / IA
        </h2>
      </div>

      {/* KPIs grandes — combinado Direto + IA */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <BigStatCard
          label="Total Vendido (Direto + IA)"
          value={BRL.format(t.valor)}
          accent={COLOR.info}
          valueColor={COLOR.neutral}
        />
        <BigStatCard
          label="Ticket Medio"
          value={BRL.format(t.ticketReal)}
          accent={COLOR.info}
          valueColor={COLOR.neutral}
        />
        <BigStatCard
          label="% Conversao (site)"
          value={fmtPct(t.conversao)}
          accent={COLOR.info}
          valueColor={COLOR.neutral}
        />
        <BigStatCard
          label="Visitas no Mes (site)"
          value={fmtInt.format(t.visits)}
          accent={COLOR.info}
          valueColor={COLOR.neutral}
        />
      </section>

      {/* Split por canal e BU */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="card-lg">
          <div className="kpi-label mb-2">Split por canal</div>
          <div className="grid grid-cols-2 gap-2">
            <SplitTile
              label="Direto (site)"
              valor={t.valorDireto}
              qtd={t.qtdDireto}
              color="#74aee0"
            />
            <SplitTile
              label="IA (atendimento)"
              valor={t.valorIA}
              qtd={t.qtdIA}
              color="#b99be0"
            />
          </div>
        </div>
        <div className="card-lg">
          <div className="kpi-label mb-2">Split por BU</div>
          <div className="grid grid-cols-2 gap-2">
            <SplitTile
              label="CPPEM"
              valor={t.valorCppem}
              qtd={t.qtdCppem}
              color="#5fd08f"
            />
            <SplitTile
              label="UNICIVE"
              valor={t.valorUnicive}
              qtd={t.qtdUnicive}
              color="#f59e0b"
            />
          </div>
        </div>
      </section>

      {/* Breakdown CPPEM (direto + IA CPPEM) — abaixo do grafico */}
      <ProductRevenueBreakdown
        rows={snap.breakdown}
        color="#74aee0"
      />

      {/* Breakdown UNICIVE — so aparece se ha venda IA em UNICIVE */}
      {hasUnicive && (
        <ProductRevenueBreakdown
          rows={snap.breakdownUnicive}
          color="#c4b5fd"
        />
      )}

      {/* ===== Ultima secao: Origem por Onvox e por Indicacao
          Agregado de todas as BUs — reaproveitado da antiga "Visao Geral". ===== */}
      {(ligacao || indicacao) && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {ligacao && (
            <OriginDonut
              rows={ligacao}
              statuses={LIGACAO_STATUSES}
              title="Origem por Onvox — Geral"
              subtitle="A ligacao Onvox influenciou a venda? (todas as BUs)"
            />
          )}
          {indicacao && (
            <OriginDonut
              rows={indicacao}
              statuses={INDICACAO_STATUSES}
              title="Origem por Indicacao — Geral"
              subtitle="A venda veio de indicacao? (todas as BUs)"
            />
          )}
        </section>
      )}
    </div>
  );
}

function SplitTile({
  icon,
  label,
  valor,
  qtd,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  valor: number;
  qtd: number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-panel2 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
        <span>{label}</span>
      </div>
      <div className="text-xl xl:text-2xl font-extrabold mt-0.5" style={{ color }}>
        {BRL.format(valor)}
      </div>
      <div className="text-[10px] text-white/40 mt-0.5">
        {fmtInt.format(qtd)} un.
      </div>
    </div>
  );
}

