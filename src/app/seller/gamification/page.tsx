import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getSeller, statsForAll, buListOf } from "@/lib/data";
import { periodNow, BRL, fmtPct } from "@/lib/calc";
import { BU_COLOR, BU_LABEL, COLOR, tonePctMeta } from "@/lib/brand";
import { type BU } from "@/lib/products";
import { loadCommissionRules, calcCommission, rankBUBonus, type CommissionRules } from "@/lib/commission";
import ProgressBar from "@/components/ProgressBar";
import { Flame } from "lucide-react";
import CommissionProgress from "./CommissionProgress";

export const dynamic = "force-dynamic";

export default async function GamificationPage({
  searchParams,
}: {
  searchParams: { bu?: string };
}) {
  const s = await getSession();
  const seller = (await getSeller(s!.sellerId!))!;
  const bus = buListOf(seller);
  const requested = (["cppem", "unicive", "colegio_cppem"] as BU[]).includes(searchParams.bu as BU)
    ? (searchParams.bu as BU)
    : null;
  const bu: BU = requested && bus.includes(requested) ? requested : bus[0];

  const { year, month } = periodNow();
  const [allStats, rulesMap] = await Promise.all([
    statsForAll({ year, month }),
    loadCommissionRules(),
  ]);
  const rules = rulesMap[bu];
  const color = BU_COLOR[bu];

  // stats desse vendedor nesta BU
  const mine = allStats.find((r) => r.sellerId === seller.id && r.bu === bu);
  const realizado = mine?.valorRealizado ?? 0;
  const meta = mine?.valorMeta ?? 0;

  const calc = calcCommission(realizado, meta, rules);

  // Ranking coletivo da BU — usa TODOS os vendedores da BU mas so devolve
  // ao vendedor a posicao propria (sem nomes dos outros).
  const buSellers = allStats.filter((r) => r.bu === bu);
  const buBonus = rankBUBonus(
    buSellers.map((r) => ({ sellerId: r.sellerId, realizado: r.valorRealizado, meta: r.valorMeta })),
    rules
  );
  const myPodium = buBonus.ranking.find((r) => r.sellerId === seller.id) || null;

  const totalPayout = calc.commissionValue + (myPodium?.bonus || 0);
  const tone = tonePctMeta(calc.pctMeta, meta - realizado);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header + BU switcher */}
      <div className="card-lg !py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
            Gamificacao — {BU_LABEL[bu]}
          </div>
          <h1 className="font-display text-xl font-bold mt-0.5">
            Comissao ao vivo de {seller.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-white/50 mt-1">
            Cada venda atualiza tudo em tempo real. Bata os checkpoints pra desbloquear tiers maiores.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {bus.length > 1 && (
            <div className="inline-flex p-1 rounded-xl bg-panel border border-border">
              {bus.map((b) => (
                <Link
                  key={b}
                  href={`/seller/gamification?bu=${b}`}
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
        </div>
      </div>

      {/* KPI grande: comissao estimada + tier + bonus */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div
          className="card-lg lg:col-span-3 relative overflow-hidden flex flex-col justify-center"
          style={{ borderColor: color + "55" }}
        >
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-[0.14]"
            style={{ background: "#c9ae7a" }}
          />
          <div className="relative">
            <div className="text-xs uppercase tracking-wider text-white/50 flex items-center gap-1">
              Comissao estimada do mes
            </div>
            <div
              className="font-display text-4xl sm:text-5xl font-bold mt-1.5 leading-none"
              style={{ color: calc.commissionValue > 0 ? color : "#ada99b" }}
            >
              {BRL.format(calc.commissionValue)}
            </div>
            <div className="text-sm text-white/60 mt-2">
              {calc.tier
                ? <>Tier atual <b style={{ color }}>{calc.tier.meta_pct}%</b> da meta ={" "}
                    <b style={{ color }}>{calc.commissionPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</b> de comissao</>
                : meta > 0
                  ? <>Voce ainda nao atingiu o minimo de <b>{rules.min_meta_pct}%</b> da meta pra ter comissao.</>
                  : <>Sua meta ainda nao foi definida pelo administrador.</>}
            </div>
            {totalPayout > 0 && myPodium?.bonus ? (
              <div className="text-xs text-white/60 mt-2">
                + <b style={{ color: COLOR.ok }}>{BRL.format(myPodium.bonus)}</b> de bonus do podio ={" "}
                <b style={{ color: COLOR.ok }}>{BRL.format(totalPayout)}</b> pra resgatar no fim do mes.
              </div>
            ) : null}
          </div>
        </div>

        <div className="card-lg lg:col-span-2 flex flex-col justify-center">
          <div className="text-xs uppercase tracking-wider text-white/50">Faturamento (real / meta)</div>
          <div className="font-display font-bold text-3xl leading-none mt-1.5">
            {BRL.format(realizado)}
            <span className="text-white/40 text-base font-semibold"> / {BRL.format(meta)}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={calc.pctMeta} color={tone} height={6} />
          </div>
          <div className="text-sm text-white/60 mt-2">
            {meta > 0 ? `${fmtPct(calc.pctMeta)} da meta` : "Sem meta definida"}
          </div>
        </div>
      </section>

      {/* Progresso com avatar andando + Bonus do Podio ao lado */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-stretch">
        <CommissionProgress
          color={color}
          rules={rules}
          realizado={realizado}
          meta={meta}
          pctMeta={calc.pctMeta}
          nextTier={calc.nextTier}
          toNextTier={calc.toNextTier}
          avatarUrl={seller.avatar_url}
          avatarInitial={seller.name.trim().charAt(0).toUpperCase() || "?"}
          avatarColor={seller.avatar_color || color}
        />

        <PodiumCard
          bu={bu}
          rules={rules}
          buBonus={buBonus}
          myPodium={myPodium}
          color={color}
        />
      </section>

      {/* Tabela de tiers */}
      <section className="card-lg p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold flex items-center gap-2">
            Tabela de comissao vigente — {BU_LABEL[bu]}
          </div>
          <div className="text-xs text-white/50 mt-1">
            Comissao {rules.cumulative ? "acumulativa" : "nao acumulativa"}. Liberada a partir de <b>{rules.min_meta_pct}%</b> da meta.
            Base de calculo: <b>receita vendida por voce</b>.
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-white/40 bg-panel2">
            <tr className="text-left">
              <th className="px-4 py-2.5">% Meta Ind.</th>
              <th className="px-4 py-2.5">% Comissao</th>
              <th className="px-4 py-2.5 text-right">Se aplicasse no seu realizado</th>
              <th className="px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rules.tiers.map((t) => {
              const reached = calc.tier && t.meta_pct <= calc.tier.meta_pct;
              const isCurrent = calc.tier?.meta_pct === t.meta_pct;
              const wouldPay = (t.commission_pct / 100) * realizado;
              return (
                <tr
                  key={t.meta_pct}
                  className={`border-t border-border ${
                    isCurrent ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-semibold">{t.meta_pct}%</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: reached ? color : undefined }}>
                    {t.commission_pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/70">{BRL.format(wouldPay)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isCurrent ? (
                      <span className="chip" style={{ background: color + "22", color }}>
                        <Flame className="w-3 h-3" /> Voce esta aqui
                      </span>
                    ) : reached ? (
                      <span className="chip" style={{ background: COLOR.ok + "22", color: COLOR.ok }}>
                        Batido
                      </span>
                    ) : (
                      <span className="text-xs text-white/40">
                        Faltam {BRL.format(Math.max(0, (t.meta_pct / 100) * meta - realizado))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {rules.notes && (
        <div className="card text-xs text-white/60">
          <b>Regras:</b> {rules.notes}
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  bu,
  rules,
  buBonus,
  myPodium,
  color,
}: {
  bu: BU;
  rules: CommissionRules;
  buBonus: ReturnType<typeof rankBUBonus>;
  myPodium: ReturnType<typeof rankBUBonus>["ranking"][number] | null;
  color: string;
}) {
  return (
    <div
      className="card-lg h-full flex flex-col gap-3"
      style={{ borderColor: buBonus.unlocked ? COLOR.ok + "55" : undefined }}
    >
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">Bonus do podio — {BU_LABEL[bu]}</div>
      </div>
      <div className="text-xs text-white/60 leading-snug">
        Se a BU atingir <b>{buBonus.unlockedAt.toFixed(0)}%</b> da meta coletiva, libera:
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <PodiumChip pos={1} value={rules.top1_bonus} unlocked={buBonus.unlocked} />
        <PodiumChip pos={2} value={rules.top2_bonus} unlocked={buBonus.unlocked} />
        <PodiumChip pos={3} value={rules.top3_bonus} unlocked={buBonus.unlocked} />
      </div>
      <div className="text-xs text-white/60">
        Coletiva:{" "}
        <b style={{ color: buBonus.unlocked ? COLOR.ok : "#ada99b" }}>
          {fmtPct(buBonus.pctColetivo)}
        </b>
      </div>
      <div className="mt-auto rounded-xl border border-border p-3 bg-panel2/40">
        {myPodium ? (
          <>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              Sua posicao no podio
            </div>
            <div className="font-display text-xl font-bold mt-0.5" style={{ color: buBonus.unlocked ? COLOR.ok : color }}>
              {myPodium.position}o lugar
            </div>
            <div className="text-xs text-white/60 mt-0.5">
              {buBonus.unlocked
                ? <>+ <b style={{ color: COLOR.ok }}>{BRL.format(myPodium.bonus)}</b> ja garantidos</>
                : <>Aguardando a BU atingir a coletiva</>}
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Sua posicao</div>
            <div className="text-sm text-white/70 mt-0.5">Ainda fora do top 3</div>
            <div className="text-xs text-white/50 mt-0.5">
              Continue vendendo pra brigar por uma vaga.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PodiumChip({
  pos,
  value,
  unlocked,
}: {
  pos: 1 | 2 | 3;
  value: number;
  unlocked: boolean;
}) {
  const medals = ["#eab308", "#ada99b", "#b45309"];
  return (
    <div
      className={`rounded-xl border px-2 py-2.5 ${
        unlocked ? "border-border bg-panel2" : "border-border/60 bg-panel2/40"
      }`}
    >
      <div className="text-xl leading-none">{["🥇", "🥈", "🥉"][pos - 1]}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50 mt-1">Top {pos}</div>
      <div
        className="text-sm font-bold mt-0.5"
        style={{ color: unlocked ? medals[pos - 1] : "#64748b" }}
      >
        {BRL.format(value)}
      </div>
    </div>
  );
}
