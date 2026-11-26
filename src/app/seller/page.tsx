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
import Indicador, { type Linha } from "@/components/Indicador";
import BotaoTelaCheia from "@/components/BotaoTelaCheia";
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChartLazy";
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
  // Faixa "Minha meta" no padrao `Indicador`: numero principal = realizado (o unico
  // com cor), o resto em linhas sem cor. Pace e projecao viraram linhas.
  const duPassados = businessDaysElapsed(year, month);
  const duTotal = businessDaysInMonth(year, month);
  const pace = paceProjection(stats.realizado, stats.metaTotal, duPassados, duTotal);
  const paceFat = paceProjection(stats.valorRealizado, stats.valorMeta, duPassados, duTotal);
  const pctTone = tonePctMeta(stats.pctSucesso, stats.gap);
  const pctFat = stats.valorMeta > 0 ? (stats.valorRealizado / stats.valorMeta) * 100 : 0;
  const sinal = (v: number) => (v >= 0 ? "+" : "−");
  const tomMes = (p: { hasMeta: boolean; paceIsAhead: boolean }, batida: boolean) =>
    !p.hasMeta ? COLOR.neutral : batida || p.paceIsAhead ? COLOR.ok : COLOR.danger;
  const linhasRitmo = (p: { hasMeta: boolean; paceDelta: number; projecao: number }, fmt: (n: number) => string): Linha[] =>
    p.hasMeta ? [["Pace", `${sinal(p.paceDelta)}${fmt(Math.abs(p.paceDelta))}`], ["Projecao", fmt(p.projecao)]] : [];
  const batida = stats.metaTotal > 0 && stats.realizado >= stats.metaTotal;
  const hojeBatido = stats.metaDia > 0 && stats.realizadoHoje >= stats.metaDia;
  const ticketTone =
    stats.ticketMeta > 0 ? (stats.ticketReal >= stats.ticketMeta ? COLOR.ok : COLOR.danger) : COLOR.neutral;
  const convTone =
    stats.conversaoMeta > 0 ? (stats.conversaoReal >= stats.conversaoMeta ? COLOR.ok : COLOR.danger) : COLOR.neutral;

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

  // Indicadores da faixa "Minha meta": 4 em toda BU (+ faturamento nas BUs de
  // quantidade, + matriculas no Unicive). 4 por linha; 3 quando passa de 4. As
  // celulas vazias so completam a ultima linha (a grade fica fechada).
  const nCells = 4 + (isQtd ? 1 : 0) + (bu === "unicive" ? 1 : 0);
  const perRow = nCells > 4 ? 3 : 4;
  const fillers = (perRow - (nCells % perRow)) % perRow;


  return (
    <div className="space-y-2">
      {/* Esquerda: minha meta (indicadores em 2 linhas) + evolucao diaria.
          Direita: minha comissao, do topo ate embaixo (o que o vendedor mais olha). */}
      <div className="meu-painel-grade grid grid-cols-1 xl:grid-cols-12 gap-2 items-stretch">
      <div className="xl:col-span-6 min-w-0 flex flex-col gap-2">
      <section>
        {/* Sem cabecalho (26/11/2026): foto e senha estao na barra do topo. O seletor
            de BU so aparece para quem vende em mais de uma. */}
        <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
          <div className="eyebrow-label">Minha meta</div>
          <div className="flex items-center gap-2">
          {bus.length > 1 && (
            <div className="inline-flex p-0.5 rounded-xl bg-panel2 border border-border">
              {bus.map((b) => (
                <Link
                  key={b}
                  href={`/seller?bu=${b}`}
                  scroll={false}
                  className={`px-2.5 py-0.5 rounded-lg font-ui text-[11px] font-bold uppercase tracking-[0.1em] transition ${
                    b === bu ? "bg-accent text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  {BU_LABEL[b]}
                </Link>
              ))}
            </div>
          )}
            <BotaoTelaCheia />
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className={`-ml-px -mt-px grid grid-cols-2 ${perRow === 3 ? "md:grid-cols-3" : "md:grid-cols-4"} [&_.cell]:!p-3 [&_.cell_.font-display]:!text-[clamp(1.05rem,1.15vw,1.45rem)]`}>
            <Indicador
              label={isQtd ? "Matriculas" : "Total vendido"}
              value={fmtMeta(stats.realizado)}
              tone={tomMes(pace, batida)}
              linhas={[
                ["Meta", stats.metaTotal > 0 ? `${fmtMeta(stats.metaTotal)} · ${fmtPct(stats.pctSucesso)}` : "Sem meta"],
                ...(stats.metaTotal > 0 ? ([["Falta", batida ? "Batida" : fmtMeta(stats.falta)]] as Linha[]) : []),
                ...linhasRitmo(pace, fmtMeta),
              ]}
            />
            {isQtd && (
              <Indicador
                label="Faturamento"
                value={BRL.format(stats.valorRealizado)}
                tone={tomMes(paceFat, stats.valorMeta > 0 && stats.valorRealizado >= stats.valorMeta)}
                linhas={[
                  ["Meta", stats.valorMeta > 0 ? `${BRL.format(stats.valorMeta)} · ${fmtPct(pctFat)}` : "Sem meta"],
                  ...linhasRitmo(paceFat, (n) => BRL.format(n)),
                ]}
              />
            )}
            <Indicador
              label={isQtd ? "Hoje (matriculas)" : "Vendido hoje"}
              value={fmtMeta(stats.realizadoHoje)}
              tone={hojeBatido ? COLOR.ok : COLOR.neutral}
              linhas={
                stats.metaDia > 0
                  ? [
                      ["Meta do dia", fmtMeta(stats.metaDia)],
                      ["Falta", hojeBatido ? "Batida" : fmtMeta(Math.max(0, stats.metaDia - stats.realizadoHoje))],
                    ]
                  : [["Meta do dia", "Sem meta"]]
              }
            />
            <Indicador
              label="Ticket medio"
              value={BRL.format(stats.ticketReal)}
              tone={ticketTone}
              linhas={[
                ["Meta", stats.ticketMeta > 0 ? BRL.format(stats.ticketMeta) : "Sem meta"],
                ["Vendas no mes", fmtInt.format(stats.vendasCount)],
              ]}
            />
            <Indicador
              label="Conversao"
              value={fmtPct(stats.conversaoReal)}
              tone={convTone}
              linhas={[
                ["Meta", stats.conversaoMeta > 0 ? fmtPct(stats.conversaoMeta) : "Sem meta"],
                ["Vendas / leads", `${fmtInt.format(stats.vendasCount)} / ${fmtInt.format(stats.leads)}`],
              ]}
            />
            {bu === "unicive" ? (
              <Indicador
                label="Matriculas"
                value={fmtInt.format(stats.qtdRealizada)}
                tone={stats.qtdMeta > 0 && stats.qtdRealizada >= stats.qtdMeta ? COLOR.ok : COLOR.neutral}
                linhas={[["Meta", stats.qtdMeta > 0 ? `${fmtInt.format(stats.qtdMeta)} · ${fmtPct((stats.qtdRealizada / stats.qtdMeta) * 100)}` : "Sem meta"]]}
              />
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
