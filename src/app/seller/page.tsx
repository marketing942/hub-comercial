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
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChart";
import AvatarUploader from "@/components/AvatarUploader";
import NewSaleButton from "./sales/NewSaleButton";
import ChangePasswordButton from "@/components/ChangePasswordButton";

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

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="space-y-4">
      {/* Header sem frase motivacional */}
      <div className="card-lg flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <AvatarUploader name={seller.name} initialUrl={seller.avatar_url} color={color} />
          <div>
            <div className="flex items-center gap-2">
              <BULogo bu={bu} size={18} />
              <span className="text-xs uppercase tracking-wider text-white/50">{BU_LABEL[bu]}</span>
            </div>
            <div className="text-xl xl:text-2xl font-bold mt-1">
              Ola, {seller.name.split(" ")[0]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {bus.length > 1 && (
            <div className="inline-flex p-1 rounded-xl bg-panel border border-border">
              {bus.map((b) => (
                <Link
                  key={b}
                  href={`/seller?bu=${b}`}
                  scroll={false}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    b === bu ? "bg-accent text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  {BU_LABEL[b]}
                </Link>
              ))}
            </div>
          )}
          <NewSaleButton sellerBus={bus} />
          <ChangePasswordButton
            sellerName={seller.name}
            hasPassword={Boolean(seller.has_password)}
          />
        </div>
      </div>

      {/* Indicadores (esquerda) + evolucao diaria com ritmo (direita), como no dash da BU */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="panel overflow-hidden xl:col-span-5 2xl:col-span-4">
          <div className="-ml-px -mt-px grid grid-cols-2">
            {/* Meta principal + barra de progresso (substitui "Quanto falta pra minha meta") */}
            <div className="col-span-2">
              <Cell
                label={isQtd ? "Matriculas (real / meta)" : "Total vendido (real / meta)"}
                value={fmtMeta(stats.realizado)}
                tone={COLOR.neutral}
              >
                <div className="mt-1">
                  <ProgressBar value={stats.pctSucesso} color={pctTone} height={8} />
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
              <div className="col-span-2">
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
            ) : (
              <div className="cell min-w-0" aria-hidden />
            )}
          </div>
        </section>

        <section className="panel p-5 xl:col-span-7 2xl:col-span-8 min-w-0 flex flex-col">
          <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
            <div>
              <div className="eyebrow-label">Minha evolucao diaria</div>
              <div className="text-xs text-white/45 mt-1">
                {isQtd ? "Matriculas" : "Vendas"} por dia, leads e % da minha meta acumulada
                <span className="capitalize"> · {monthName}</span>
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/35">Tracejado = ritmo ideal ate o fim do mes</div>
          </div>
          <div className="flex-1 min-h-0">
            <UnifiedDailyChart
              data={chartRows}
              leftUnit={isQtd ? "int" : "currency"}
              rightUnit="percent"
              rightPercentScale
              showIdealReference
              today={todayDayOfMonth(year, month)}
              height={440}
              series={[
                { key: isQtd ? "qtd" : "valor", label: isQtd ? "Matriculas (dia)" : "Minhas vendas (dia)", color, axis: "left", unit: isQtd ? "int" : "currency", strokeWidth: 2.5 },
                { key: "leads", label: "Leads (dia)", color: COLOR.info, axis: "left", unit: "int", strokeWidth: 2 },
                { key: "pct", label: "% Minha meta acumulada", color: pctTone, axis: "right", unit: "percent", strokeWidth: 3 },
                { key: "idealPct", label: "% Ideal", color: COLOR.warning, axis: "right", unit: "percent", dashed: true, strokeWidth: 1.5 },
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
