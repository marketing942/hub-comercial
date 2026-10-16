import type { DirectSnapshot, DirectChannelAgg, ProductBreakdownRow } from "@/lib/data";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import Cell from "@/components/StatCell";

// Direto / IA — duas partes na mesma aba: Site (venda direta) e IA (atendimento).
// As origens (Onvox e Indicacao) ficam na aba Vendedores.
export default function DirectDashboardView({
  snap,
}: {
  snap: DirectSnapshot;
  day?: number;
  totalDays?: number;
  daysLeft?: number;
  monthName?: string;
}) {
  const t = snap.totals;
  // Cache de formato antigo (sem "channels"): nao quebra a pagina, so aguarda o proximo refresh.
  if (!snap.channels) {
    return <div className="panel p-6 text-sm text-white/60">Atualizando dados do Direto / IA...</div>;
  }
  const site = snap.channels.direto;
  const ia = snap.channels.ia;
  const share = (v: number) => (t.valor > 0 ? (v / t.valor) * 100 : 0);

  return (
    <div className="space-y-4">
      {/* Visao geral: o total e como ele se divide entre os dois canais */}
      <section className="panel overflow-hidden">
        <div className="-ml-px -mt-px grid grid-cols-2 xl:grid-cols-4">
          <Cell label="Total vendido (Site + IA)" value={BRL.format(t.valor)} />
          <Cell label="Ticket medio geral" value={BRL.format(t.ticketReal)} />
          <Cell label="Site (direto)" value={BRL.format(site.valor)}>
            <Bar pct={share(site.valor)} /> {fmtPct(share(site.valor))} do total
          </Cell>
          <Cell label="IA (atendimento)" value={BRL.format(ia.valor)}>
            <Bar pct={share(ia.valor)} /> {fmtPct(share(ia.valor))} do total
          </Cell>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <ChannelPanel
          title="Site"
          subtitle="Venda direta pelo site"
          agg={site}
          stats={
            <>
              <Cell label="Faturado" value={BRL.format(site.valor)} />
              <Cell label="Unidades" value={fmtInt.format(site.qtd)} />
              <Cell label="Ticket medio" value={BRL.format(site.qtd > 0 ? site.valor / site.qtd : 0)} />
              <Cell label="Visitas no mes" value={fmtInt.format(t.visits)} />
              <Cell label="% Conversao" value={fmtPct(t.visits > 0 ? (site.qtd / t.visits) * 100 : 0)}>
                Unidades do site / visitas
              </Cell>
            </>
          }
        />
        <ChannelPanel
          title="IA"
          subtitle="Vendas do atendimento por IA"
          agg={ia}
          stats={
            <>
              <Cell label="Faturado" value={BRL.format(ia.valor)} />
              <Cell label="Unidades" value={fmtInt.format(ia.qtd)} />
              <Cell label="Ticket medio" value={BRL.format(ia.qtd > 0 ? ia.valor / ia.qtd : 0)} />
            </>
          }
        />
      </div>
    </div>
  );
}

const HEAD = "font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40";

function Bar({ pct }: { pct: number }) {
  return (
    <span className="block mb-1.5 h-[5px] rounded-full bg-white/10 overflow-hidden">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: COLOR.gold }} />
    </span>
  );
}

function ChannelPanel({
  title,
  subtitle,
  agg,
  stats,
}: {
  title: string;
  subtitle: string;
  agg: DirectChannelAgg;
  stats: React.ReactNode;
}) {
  const hasUnicive = agg.valorUnicive > 0 || agg.breakdownUnicive.some((r) => r.valor > 0);
  return (
    <section className="panel overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--hair)]">
        <div className="font-display font-bold uppercase tracking-wide text-xl text-accent">{title}</div>
        <div className="text-xs text-white/45 mt-0.5">{subtitle}</div>
      </div>

      <div className="overflow-hidden">
        <div className="-ml-px grid grid-cols-2 sm:grid-cols-3">{stats}</div>
      </div>

      {/* Por BU */}
      <SectionTitle>Por BU</SectionTitle>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-4 px-5 py-2 ${HEAD}`}>
        <span>BU</span>
        <span className="text-right">Faturado</span>
        <span className="text-right">Unidades</span>
      </div>
      {[
        { label: "CPPEM", valor: agg.valorCppem, qtd: agg.qtdCppem },
        { label: "UNICIVE", valor: agg.valorUnicive, qtd: agg.qtdUnicive },
      ].map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-4 px-5 py-2.5 border-t border-[var(--hair)]"
        >
          <span className="text-sm font-semibold">{r.label}</span>
          <span className="text-right text-sm font-semibold">{BRL.format(r.valor)}</span>
          <span className="text-right text-sm text-white/70">{fmtInt.format(r.qtd)} un.</span>
        </div>
      ))}

      {/* Receita por categoria */}
      <SectionTitle>Receita por categoria</SectionTitle>
      <CategoryRows title="CPPEM" rows={agg.breakdown} showTitle={hasUnicive} />
      {hasUnicive && <CategoryRows title="UNICIVE" rows={agg.breakdownUnicive} showTitle />}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-2.5 border-t border-[var(--hair)] bg-white/[0.02] eyebrow-label">{children}</div>;
}

function CategoryRows({ title, rows, showTitle }: { title: string; rows: ProductBreakdownRow[]; showTitle: boolean }) {
  const visible = rows.filter((r) => r.valor > 0 || r.qtd > 0 || r.valor_meta > 0 || r.quantidade_meta > 0);
  const list = visible.length > 0 ? visible : rows;
  return (
    <div>
      {showTitle && (
        <div className={`px-5 pt-2 ${HEAD}`} style={{ color: "var(--gold-light)" }}>
          {title}
        </div>
      )}
      {list.map((r) => (
        <div
          key={`${title}_${r.product_line}`}
          className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-4 px-5 py-2.5 border-t border-[var(--hair)]"
        >
          <span className="text-sm font-semibold truncate">{r.label}</span>
          <span className="text-right text-sm font-semibold">{BRL.format(r.valor)}</span>
          <span className="text-right text-sm text-white/70">{fmtInt.format(r.qtd)} un.</span>
        </div>
      ))}
    </div>
  );
}
