import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getSeller, statsForSellerInBu, buSeries, buListOf } from "@/lib/data";
import { BRL, fmtInt, fmtPct, periodNow } from "@/lib/calc";
import { BU_COLOR, BU_LABEL, COLOR, tonePctMeta } from "@/lib/brand";
import { isQtdPrimary, type BU } from "@/lib/products";
import BULogo from "@/components/BULogo";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";
import DailySalesChart from "@/components/charts/DailySalesChart";
import AvatarUploader from "@/components/AvatarUploader";
import NewSaleButton from "./sales/NewSaleButton";
import ChangePasswordButton from "@/components/ChangePasswordButton";
import {
  Flame,
  Target,
  TrendingUp,
  Wallet,
  Users,
  Trophy,
} from "lucide-react";

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
  const [stats, series] = await Promise.all([
    statsForSellerInBu(seller, bu, { year, month }),
    buSeries(bu, { year, month }),
  ]);
  const isQtd = isQtdPrimary(bu);
  const color = BU_COLOR[bu];
  const fmtMeta = (n: number) => (isQtd ? fmtInt.format(Math.round(n)) : BRL.format(n));
  const pctTone = tonePctMeta(stats.pctSucesso, stats.gap);

  const pctFat = isQtd && series.totals.metaValor > 0
    ? (series.totals.valor / series.totals.metaValor) * 100
    : 0;

  return (
    <div className="space-y-5">
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

      {/* 4 KPIs principais — cores semanticas */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {isQtd ? (
          <>
            <StatCard
              label="Matriculas (Real / Meta)"
              value={`${fmtInt.format(stats.realizado)} / ${fmtInt.format(stats.metaTotal)}`}
              hint={`${fmtPct(stats.pctSucesso)} da meta`}
              icon={<TrendingUp className="w-4 h-4" />}
              accent={COLOR.neutral}
            />
            <StatCard
              label="Faturamento (Real / Meta)"
              value={`${BRL.format(series.totals.valor)} / ${BRL.format(series.totals.metaValor)}`}
              hint={series.totals.metaValor > 0 ? `${fmtPct(pctFat)} da meta` : "Sem meta"}
              icon={<Wallet className="w-4 h-4" />}
              accent={COLOR.neutral}
            />
            <StatCard
              label="Meta do Dia (matriculas)"
              value={fmtInt.format(Math.round(stats.metaDia))}
              hint={stats.gap > 0 ? `Atrasado em ${fmtInt.format(Math.round(stats.gap))}` : "No ritmo"}
              icon={<Flame className="w-4 h-4" />}
              accent={pctTone}
            />
            <StatCard
              label="Ticket Medio"
              value={BRL.format(stats.ticketReal)}
              hint={stats.ticketMeta > 0 ? `Meta ${BRL.format(stats.ticketMeta)}` : "Sem meta"}
              icon={<Wallet className="w-4 h-4" />}
              accent={
                stats.ticketMeta > 0
                  ? stats.ticketReal >= stats.ticketMeta
                    ? COLOR.ok
                    : COLOR.danger
                  : COLOR.neutral
              }
            />
          </>
        ) : (
          <>
            <StatCard
              label="Total Vendido (Real / Meta)"
              value={`${BRL.format(stats.realizado)} / ${BRL.format(stats.metaTotal)}`}
              hint={`${fmtPct(stats.pctSucesso)} da meta`}
              icon={<Wallet className="w-4 h-4" />}
              accent={COLOR.neutral}
            />
            <StatCard
              label="Meta do Dia"
              value={BRL.format(stats.metaDia)}
              hint={stats.gap > 0 ? `Atrasado em ${BRL.format(stats.gap)}` : "No ritmo"}
              icon={<Flame className="w-4 h-4" />}
              accent={pctTone}
            />
            <StatCard
              label="Ticket Medio"
              value={BRL.format(stats.ticketReal)}
              hint={stats.ticketMeta > 0 ? `Meta ${BRL.format(stats.ticketMeta)}` : "Sem meta"}
              icon={<Wallet className="w-4 h-4" />}
              accent={
                stats.ticketMeta > 0
                  ? stats.ticketReal >= stats.ticketMeta
                    ? COLOR.ok
                    : COLOR.danger
                  : COLOR.neutral
              }
            />
            <StatCard
              label="Conversao"
              value={fmtPct(stats.conversaoReal)}
              hint={stats.conversaoMeta > 0 ? `Meta ${fmtPct(stats.conversaoMeta)}` : `${stats.vendasCount} vendas`}
              icon={<Target className="w-4 h-4" />}
              accent={
                stats.conversaoMeta > 0
                  ? stats.conversaoReal >= stats.conversaoMeta
                    ? COLOR.ok
                    : COLOR.danger
                  : COLOR.info
              }
            />
          </>
        )}
      </section>

      {/* Barra: ja tem os numeros nos cards, aqui so o ritmo */}
      <section className="card">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            Quanto falta pra minha meta
          </div>
          <div className="text-xs font-semibold" style={{ color: pctTone }}>
            {fmtPct(stats.pctSucesso)}
          </div>
        </div>
        <ProgressBar value={stats.pctSucesso} color={pctTone} height={12} />
        <div className="text-center text-xs text-white/60 mt-2">
          {stats.pctSucesso >= 100
            ? "Meta atingida"
            : `Hoje precisa fazer ${fmtMeta(stats.metaDia)} pra manter o ritmo`}
        </div>
      </section>

      {/* Indicadores secundarios sem repetir o que ja apareceu */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Realizado Hoje"
          value={fmtMeta(stats.realizadoHoje)}
          hint={`${stats.vendasCount} venda${stats.vendasCount === 1 ? "" : "s"} no mes`}
          icon={<Trophy className="w-4 h-4" />}
          accent={stats.realizadoHoje > 0 ? COLOR.ok : COLOR.neutral}
        />
        {isQtd ? (
          <StatCard
            label="Conversao"
            value={fmtPct(stats.conversaoReal)}
            hint={stats.conversaoMeta > 0 ? `Meta ${fmtPct(stats.conversaoMeta)}` : `${stats.vendasCount} vendas`}
            icon={<Target className="w-4 h-4" />}
            accent={
              stats.conversaoMeta > 0
                ? stats.conversaoReal >= stats.conversaoMeta
                  ? COLOR.ok
                  : COLOR.danger
                : COLOR.info
            }
          />
        ) : (
          <StatCard
            label="Faltam"
            value={BRL.format(stats.falta)}
            hint={stats.pctSucesso >= 100 ? "Meta batida" : `Pra fechar a meta`}
            icon={<TrendingUp className="w-4 h-4" />}
            accent={stats.pctSucesso >= 100 ? COLOR.ok : COLOR.danger}
          />
        )}
        <StatCard
          label="Leads Recebidos"
          value={fmtInt.format(stats.leads)}
          hint="No mes"
          icon={<Users className="w-4 h-4" />}
          accent={COLOR.neutral}
        />
        {isQtd && (
          <StatCard
            label="% Faturamento"
            value={fmtPct(pctFat)}
            hint={series.totals.metaValor > 0 ? `Meta ${BRL.format(series.totals.metaValor)}` : "Sem meta"}
            icon={<Wallet className="w-4 h-4" />}
            accent={
              series.totals.metaValor > 0
                ? pctFat >= 100
                  ? COLOR.ok
                  : COLOR.danger
                : COLOR.neutral
            }
          />
        )}
        {bu === "unicive" && (
          <StatCard
            label="Matriculas"
            value={fmtInt.format(stats.qtdRealizada)}
            hint={
              stats.qtdMeta > 0
                ? `Meta ${fmtInt.format(stats.qtdMeta)} (${fmtPct((stats.qtdRealizada / stats.qtdMeta) * 100)})`
                : "Sem meta de matriculas"
            }
            icon={<Users className="w-4 h-4" />}
            accent={
              stats.qtdMeta > 0 && stats.qtdRealizada >= stats.qtdMeta ? COLOR.ok : COLOR.neutral
            }
          />
        )}
      </section>

      {/* Contexto da BU */}
      <div className="card">
        <div className="text-sm font-semibold mb-1">Evolucao diaria - {BU_LABEL[bu]}</div>
        <div className="text-xs text-white/50 mb-2">Como a sua BU esta performando no mes</div>
        <DailySalesChart
          data={series.daily}
          color={color}
          field={isQtd ? "qtd" : "valor"}
          unit={isQtd ? "int" : "currency"}
        />
      </div>
    </div>
  );
}
