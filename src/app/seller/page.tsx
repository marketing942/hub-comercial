import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getSeller, statsForSellerInBu, sellerSeries, buListOf } from "@/lib/data";
import {
  BRL,
  businessDaysElapsed,
  businessDaysInMonth,
  fmtInt,
  fmtPct,
  paceProjection,
  periodNow,
  todayDayOfMonth,
} from "@/lib/calc";
import { BU_COLOR, BU_LABEL, COLOR, tonePctMeta } from "@/lib/brand";
import { isQtdPrimary, type BU } from "@/lib/products";
import BULogo from "@/components/BULogo";
import Cell from "@/components/StatCell";
import ProgressBar from "@/components/ProgressBar";
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChartLazy";
import AvatarUploader from "@/components/AvatarUploader";
import ChangePasswordButton from "@/components/ChangePasswordButton";
import MinhaComissao from "./MinhaComissao";

export const dynamic = "force-dynamic";

export default async function MyPanel({
  searchParams,
}: {
  searchParams: { bu?: string };
}) {
  const s = await getSession();
  const seller = (await getSeller(s!.sellerId!))!;

  const bus = buListOf(seller);
  const requested = (["cppem", "unicive", "colegio_cppem"] as BU[]).includes(
    searchParams.bu as BU
  )
    ? (searchParams.bu as BU)
    : null;
  const bu: BU = requested && bus.includes(requested) ? requested : bus[0];


  const { year, month } = periodNow();
  const stats = await statsForSellerInBu(seller, bu, { year, month });
  const series = await sellerSeries(seller, bu, stats.metaTotal, { year, month });
  // Mesma leitura do painel das BUs, recortada neste vendedor: cada categoria
  // abre nas vendas DELE que formaram aquele faturado.
  const isQtd = isQtdPrimary(bu);
  const color = BU_COLOR[bu];
  const fmtMeta = (n: number) => (isQtd ? fmtInt.format(Math.round(n)) : BRL.format(n));
  const pctTone = tonePctMeta(stats.pctSucesso, stats.gap);

  // Faturamento do proprio vendedor (so aparece como card separado nas BUs
  // cuja meta primaria e quantidade).
  const pctFat = stats.valorMeta > 0 ? (stats.valorRealizado / stats.valorMeta) * 100 : 0;
  const pctFatTone = tonePctMeta(pctFat, 0);

  // Pace e projecao do vendedor sobre a metrica primaria (dias uteis).
  const pace = paceProjection(
    stats.realizado,
    stats.metaTotal,
    businessDaysElapsed(year, month),
    businessDaysInMonth(year, month)
  );
  const paceColor = !pace.hasMeta ? COLOR.mute : pace.paceIsAhead ? COLOR.ok : COLOR.danger;
  const projColor = !pace.hasMeta ? COLOR.mute : pace.pctProjecao >= 100 ? COLOR.ok : COLOR.danger;

  const ticketTone =
    stats.ticketMeta > 0
      ? stats.ticketReal >= stats.ticketMeta
        ? COLOR.ok
        : COLOR.danger
      : COLOR.neutral;
  const convTone =
    stats.conversaoMeta > 0
      ? stats.conversaoReal >= stats.conversaoMeta
        ? COLOR.ok
        : COLOR.danger
      : COLOR.info;

  // Mesmas linhas do grafico da BU: valor/qtd do dia, leads, % acumulado e ideal.
  const cumByDay = new Map(series.cumulative.map((c) => [c.day, c]));
  const chartRows: UnifiedChartRow[] = series.daily.map((d) => {
    const c = cumByDay.get(d.day);
    return {
      day: d.day,
      valor: d.valor,
      qtd: d.qtd,
      leads: d.leads,
      pct: c ? c.pct : 0,
      idealPct: c ? c.idealPct : 0,
    };
  });

  // Indicadores da faixa "Minha meta": 8 em toda BU (+ faturamento nas BUs de
  // quantidade, + matriculas no Unicive). 4 por linha; 5 quando passa de 8. As
  // celulas vazias so completam a ultima linha (a grade fica fechada).
  const nCells = 8 + (isQtd ? 1 : 0) + (bu === "unicive" ? 1 : 0);
  const perRow = nCells > 8 ? 5 : 4;
  const fillers = (perRow - (nCells % perRow)) % perRow;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="space-y-4">
      {/* Cabecalho numa linha (o Meu Painel junta o antigo painel e a Gamificacao) */}
      <div className="panel px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <AvatarUploader name={seller.name} initialUrl={seller.avatar_url} color={color} />
        <div className="min-w-0">
          <div className="font-display text-lg font-bold leading-tight truncate">Ola, {seller.name.split(" ")[0]}</div>
          <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
            <BULogo bu={bu} size={14} />
            {BU_LABEL[bu]} · {monthName}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {bus.length > 1 && (
            <div className="inline-flex p-1 rounded-xl bg-panel2 border border-border">
              {bus.map((b) => (
                <Link
                  key={b}
                  href={`/seller?bu=${b}`}
                  scroll={false}
                  className={`px-3 py-1 rounded-lg font-ui text-[11px] font-bold uppercase tracking-[0.1em] transition ${
                    b === bu ? "bg-accent text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  {BU_LABEL[b]}
                </Link>
              ))}
            </div>
          )}
          <ChangePasswordButton sellerName={seller.name} hasPassword={Boolean(seller.has_password)} />
        </div>
      </div>

      {/* Esquerda: minha meta (indicadores em 2 linhas) + evolucao diaria.
          Direita: minha comissao, do topo ate embaixo (o que o vendedor mais olha). */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
      <div className="xl:col-span-6 min-w-0 flex flex-col gap-4">
      <section>
        <div className="mb-1.5 px-1 eyebrow-label">Minha meta</div>
        <div className="panel overflow-hidden">
          <div className={`-ml-px -mt-px grid grid-cols-2 ${nCells > 8 ? "md:grid-cols-5" : "md:grid-cols-4"} [&_.cell]:!p-3 [&_.cell_.font-display]:!text-[clamp(1.05rem,1.15vw,1.45rem)]`}>
            {/* Meta principal + barra de progresso (substitui "Quanto falta pra minha meta") */}
            <div>
              <Cell
                label={isQtd ? "Matriculas (real / meta)" : "Total vendido (real / meta)"}
                value={fmtMeta(stats.realizado)}
                tone={COLOR.neutral}
              >
                <div className="mt-1">
                  <ProgressBar value={stats.pctSucesso} color={pctTone} height={6} />
                </div>
                <div className="mt-1.5">
                  Meta <b className="text-white/70">{fmtMeta(stats.metaTotal)}</b>
                  <span className="mx-1.5 text-white/25">·</span>
                  <b style={{ color: pctTone }}>{fmtPct(stats.pctSucesso)}</b>
                </div>
                <div className="mt-0.5">
                  {stats.pctSucesso >= 100 ? (
                    <b style={{ color: COLOR.ok }}>Meta atingida</b>
                  ) : (
                    <>Faltam <b style={{ color: pctTone }}>{fmtMeta(stats.falta)}</b></>
                  )}
                </div>
              </Cell>
            </div>

            {isQtd && (
              <div>
                <Cell label="Faturamento (real / meta)" value={BRL.format(stats.valorRealizado)} tone={COLOR.neutral}>
                  <div className="mt-1">
                    <ProgressBar value={pctFat} color={pctFatTone} height={6} />
                  </div>
                  <div className="mt-1.5">
                    {stats.valorMeta > 0 ? (
                      <>
                        Meta <b className="text-white/70">{BRL.format(stats.valorMeta)}</b>
                        <span className="mx-1.5 text-white/25">·</span>
                        <b style={{ color: pctFatTone }}>{fmtPct(pctFat)}</b>
                      </>
                    ) : (
                      "Sem meta"
                    )}
                  </div>
                </Cell>
              </div>
            )}

            <Cell
              label={isQtd ? "Meta do dia (matriculas)" : "Meta do dia"}
              value={fmtMeta(stats.metaDia)}
              tone={COLOR.warning}
            >
              {stats.gap > 0 ? (
                <>Atrasado em <b style={{ color: COLOR.danger }}>{fmtMeta(stats.gap)}</b></>
              ) : (
                <b style={{ color: COLOR.ok }}>No ritmo</b>
              )}
            </Cell>
            <Cell label="Realizado hoje" value={fmtMeta(stats.realizadoHoje)} tone={stats.realizadoHoje > 0 ? COLOR.ok : COLOR.neutral}>
              {stats.vendasCount} venda{stats.vendasCount === 1 ? "" : "s"} no mes
            </Cell>

            <Cell label="Pace" value={pace.hasMeta ? `${pace.paceIsAhead ? "+" : "-"}${fmtMeta(Math.abs(pace.paceDelta))}` : "—"} tone={paceColor}>
              {pace.hasMeta ? (pace.paceIsAhead ? "Acima do ritmo ideal" : "Abaixo do ritmo ideal") : "Sem meta"}
            </Cell>
            <Cell label="Projecao" value={fmtMeta(pace.projecao)} tone={projColor}>
              {pace.hasMeta ? <>{fmtPct(pace.pctProjecao)} da meta no ritmo atual</> : "Sem meta"}
            </Cell>

            <Cell label="Ticket medio" value={BRL.format(stats.ticketReal)} tone={ticketTone}>
              {stats.ticketMeta > 0 ? <>Meta {BRL.format(stats.ticketMeta)}</> : "Sem meta"}
            </Cell>
            <Cell label="Conversao" value={fmtPct(stats.conversaoReal)} tone={convTone}>
              {stats.conversaoMeta > 0 ? <>Meta {fmtPct(stats.conversaoMeta)}</> : `${stats.vendasCount} vendas`}
            </Cell>

            <Cell label="Leads recebidos" value={fmtInt.format(stats.leads)} tone={COLOR.neutral}>
              No mes
            </Cell>
            {bu === "unicive" ? (
              <Cell label="Matriculas" value={fmtInt.format(stats.qtdRealizada)} tone={stats.qtdMeta > 0 && stats.qtdRealizada >= stats.qtdMeta ? COLOR.ok : COLOR.neutral}>
                {stats.qtdMeta > 0
                  ? `Meta ${fmtInt.format(stats.qtdMeta)} (${fmtPct((stats.qtdRealizada / stats.qtdMeta) * 100)})`
                  : "Sem meta de matriculas"}
              </Cell>
            ) : null}
            {Array.from({ length: fillers }, (_, i) => <div key={`f${i}`} className="cell max-md:hidden" aria-hidden />)}
          </div>
        </div>
      </section>

        <section className="panel p-4 min-w-0 flex-1 flex flex-col">
          <div className="eyebrow-label mb-2">Evolucao diaria</div>
            <UnifiedDailyChart
              data={chartRows}
              leftUnit={isQtd ? "int" : "currency"}
              rightUnit="percent"
              rightPercentScale
              showIdealReference
              today={todayDayOfMonth(year, month)}
              height="fill"
              series={[
                { key: isQtd ? "qtd" : "valor", label: isQtd ? "Matriculas (dia)" : "Minhas vendas (dia)", color, axis: "left", unit: isQtd ? "int" : "currency", strokeWidth: 2.5 },
                { key: "leads", label: "Leads (dia)", color: COLOR.info, axis: "left", unit: "int", strokeWidth: 2 },
                { key: "pct", label: "% Minha meta acumulada", color: pctTone, axis: "right", unit: "percent", strokeWidth: 3 },
                { key: "idealPct", label: "% Ideal", color: COLOR.warning, axis: "right", unit: "percent", dashed: true, strokeWidth: 1.5 },
              ]}
            />
        </section>
      </div>
        <div className="xl:col-span-6 min-w-0">
          <MinhaComissao seller={seller} bu={bu} color={color} year={year} month={month} />
        </div>
      </div>
    </div>
  );
}
