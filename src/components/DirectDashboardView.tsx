/**
 * Detalhe do canal Direto (so admin) — aberto ao clicar na origem "Direto" do
 * GAV (modal `gav/DetalheOrigem`). Ate 25/11/2026 era um slide proprio do
 * carrossel ("Direto / IA"); a IA saiu porque nao tem fonte desde o cutover.
 *
 * Responde: quanto o canal direto (site) vendeu x a meta dele, e em quais linhas
 * de receita. A meta e a automatica por origem do GAV (`metaPorOrigem.direto`,
 * derivada das metas por linha). As linhas sao as categorias do Conta Azul na
 * origem "direto" (`ca_linha_receita`) — o mesmo numero que o GAV mostra.
 *
 * Visitas/conversao sairam: nao ha mais onde lancar visitas do site, entao a
 * conversao era sempre 0%.
 */
import type { DirectSnapshot } from "@/lib/data";
import type { GestaoMes } from "@/lib/gestaoAVistaTipos";
import { BU_GESTAO_ROTULO, COR_BU } from "@/lib/gestaoAVistaTipos";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import { idealPctDoMes, tomRitmo } from "@/lib/ritmo";
import DuasBarras, { LegendaBarras } from "@/components/DuasBarras";

const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Mini({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-panel2/70 px-3 py-2.5">
      <div className="kpi-label truncate !text-[11px]">{rotulo}</div>
      <div className="mt-0.5 truncate text-[18px] font-semibold tabular-nums">{valor}</div>
      {nota && <div className="truncate text-[11px] text-white/40">{nota}</div>}
    </div>
  );
}

export default function DirectDashboardView({
  snap,
  gav,
  year,
  month,
}: {
  snap: DirectSnapshot;
  gav?: GestaoMes | null;
  year: number;
  month: number;
  day?: number;
  totalDays?: number;
  daysLeft?: number;
  monthName?: string;
}) {
  if (!snap.channels) {
    return <div className="panel p-6 text-sm text-white/60">Atualizando dados do Direto...</div>;
  }
  const site = snap.channels.direto;

  const meta = gav?.metaPorOrigem.direto ?? 0;
  const temMeta = meta > 0;
  const pct = temMeta ? (site.valor / meta) * 100 : 0;
  const cor = tomRitmo(pct, idealPctDoMes(year, month), temMeta);
  const ticket = site.qtd > 0 ? site.valor / site.qtd : 0;
  const partEmpresa = gav && gav.total > 0 ? (site.valor / gav.total) * 100 : null;

  // Linhas de receita do canal direto (categorias do Conta Azul).
  const linhas = (gav?.categorias ?? [])
    .map((c) => ({ chave: c.chave, rotulo: c.rotulo, bu: c.bu, valor: c.origem.direto }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const maxLinha = Math.max(1, ...linhas.map((l) => l.valor));

  return (
    <div className="grid gap-3 lg:grid-cols-12 items-start">
      {/* Canal direto x meta */}
      <section className="panel p-5 lg:col-span-5 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="eyebrow-label">Direto · site</div>
          <div className="font-display text-3xl font-bold tabular-nums" style={{ color: cor }}>
            {temMeta ? fmtPct(pct) : "—"}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex justify-end"><LegendaBarras /></div>
          <DuasBarras real={site.valor} meta={meta} cor={COLOR.gold} altura={28} />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Mini rotulo="Vendas" valor={fmtInt.format(site.qtd)} nota="unidades" />
          <Mini rotulo="Ticket médio" valor={BRL0.format(ticket)} />
          <Mini rotulo="Da receita" valor={partEmpresa !== null ? fmtPct(partEmpresa) : "—"} nota="da empresa" />
        </div>
      </section>

      {/* Em quais linhas o direto vendeu */}
      <section className="panel p-5 lg:col-span-7">
        <div className="eyebrow-label">Linhas de receita do direto</div>
        {linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">Nenhuma venda direta neste mês.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {linhas.map((l) => (
              <div key={l.chave} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-[13px]" title={l.rotulo}>
                  <i className="h-2 w-2 shrink-0 rounded-sm" style={{ background: COR_BU[l.bu] }} title={BU_GESTAO_ROTULO[l.bu]} />
                  <span className="truncate text-white/85">{l.rotulo}</span>
                </span>
                <div className="h-[18px] overflow-hidden rounded-[5px] bg-white/[0.05]">
                  <div className="h-full rounded-[5px]" style={{ width: `${(l.valor / maxLinha) * 100}%`, background: COLOR.gold }} />
                </div>
                <span className="text-right text-[13px] font-semibold tabular-nums">
                  {BRL.format(l.valor)}
                  <span className="ml-2 inline-block w-11 text-xs font-normal text-white/40">
                    {site.valor > 0 ? fmtPct((l.valor / site.valor) * 100) : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
