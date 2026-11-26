/**
 * "Minha comissao" — a antiga aba Gamificacao, agora uma secao do Meu Painel
 * (unificados em 25/11/2026). Tirou o que repetia o Meu Painel (cabecalho,
 * seletor de BU e o card "Faturamento real / meta"); ficou so o que e de
 * comissao: numeros, jornada ate o proximo checkpoint (com a tabela de tiers
 * recolhida) e o podio.
 */
import { unstable_cache } from "next/cache";
import { statsForAll, type Seller } from "@/lib/data";
import { DASHBOARD_TAG } from "@/lib/supabase";
import { BRL, fmtPct } from "@/lib/calc";
import { BU_LABEL, COLOR } from "@/lib/brand";
import { type BU } from "@/lib/products";
import { loadCommissionRules, calcCommission, rankBUBonus, type CommissionRules } from "@/lib/commission";
import Cell from "@/components/StatCell";
import { Flame } from "lucide-react";
import CommissionProgress from "./CommissionProgress";

/**
 * Stats de TODOS os vendedores do mes (o podio precisa do ranking da BU) com
 * cache de servidor COMPARTILHADO entre vendedores: sem ele, cada abertura do
 * Meu Painel releria o mes inteiro do banco. Cai junto com o dashboard a cada
 * envio do Conta Azul (`DASHBOARD_TAG`).
 */
const statsDoMes = (year: number, month: number) =>
  unstable_cache(() => statsForAll({ year, month }), [`stats-todos-v1-${year}-${month}`], {
    revalidate: 300,
    tags: [DASHBOARD_TAG],
  })();

const pctBR = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function MinhaComissao({
  seller,
  bu,
  color,
  year,
  month,
}: {
  seller: Seller;
  bu: BU;
  color: string;
  year: number;
  month: number;
}) {
  const [allStats, rulesMap] = await Promise.all([statsDoMes(year, month), loadCommissionRules()]);
  const rules = rulesMap[bu];

  const mine = allStats.find((r) => r.sellerId === seller.id && r.bu === bu);
  const realizado = mine?.valorRealizado ?? 0;
  const meta = mine?.valorMeta ?? 0;
  const calc = calcCommission(realizado, meta, rules);

  // Ranking coletivo da BU: usa todos os vendedores, mas so mostra a posicao propria.
  const buBonus = rankBUBonus(
    allStats.filter((r) => r.bu === bu).map((r) => ({ sellerId: r.sellerId, realizado: r.valorRealizado, meta: r.valorMeta })),
    rules
  );
  const myPodium = buBonus.ranking.find((r) => r.sellerId === seller.id) || null;
  const totalPayout = calc.commissionValue + (myPodium?.bonus || 0);

  // Coluna da direita do Meu Painel (ao lado do grafico): numeros numa faixa,
  // jornada com a tabela recolhida e o podio compacto, um embaixo do outro.
  return (
    <section className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1 -mb-1.5 -mt-px">
        <div className="eyebrow-label">Minha comissao</div>
        <div className="truncate text-[11px] text-white/40">
          {rules.after_tax ? `Depois de impostos (${pctBR(rules.tax_pct)}%) · ` : ""}a partir de {rules.min_meta_pct}% da meta
        </div>
      </div>

      {/* Numeros da comissao, lado a lado */}
      <div className="panel overflow-hidden">
        <div className="-ml-px -mt-px grid grid-cols-3 [&_.cell]:!p-3 [&_.cell_.font-display]:!text-[clamp(1.05rem,1.15vw,1.45rem)]">
          <Cell label="Comissao estimada" value={BRL.format(calc.commissionValue)} tone={calc.commissionValue > 0 ? COLOR.ok : COLOR.mute}>
            {calc.tier ? (
              <>Faixa de {calc.tier.meta_pct}% da meta</>
            ) : meta > 0 ? (
              <>Comeca em {rules.min_meta_pct}% (voce: {fmtPct(calc.pctMeta)})</>
            ) : (
              <>Meta ainda nao definida</>
            )}
            {myPodium?.bonus && buBonus.unlocked ? (
              <div>+ <b style={{ color: COLOR.ok }}>{BRL.format(myPodium.bonus)}</b> do podio = <b style={{ color: COLOR.ok }}>{BRL.format(totalPayout)}</b></div>
            ) : null}
          </Cell>
          <Cell label="Comissao atual" value={calc.tier ? `${pctBR(calc.commissionPct)}%` : "—"} tone={calc.tier ? COLOR.ok : COLOR.mute}>
            {calc.tier
              ? rules.after_tax
                ? `Sobre ${BRL.format(calc.baseComissao)} (faturamento menos ${pctBR(rules.tax_pct)}% de impostos)`
                : "Sobre o seu faturamento"
              : `Minimo ${rules.min_meta_pct}% da meta`}
          </Cell>
          <Cell
            label={calc.nextTier ? `Faltam p/ ${calc.nextTier.meta_pct}%` : "Faixa maxima"}
            value={calc.nextTier ? BRL.format(calc.toNextTier) : "—"}
            tone={calc.nextTier ? COLOR.warning : COLOR.ok}
          >
            {calc.nextTier ? <>Proxima: {pctBR(calc.nextTier.commission_pct)}%</> : "Voce chegou no topo"}
          </Cell>
        </div>
      </div>

      {/* Jornada + tabela de faixas recolhida */}
      <div className="panel px-4 pt-3 pb-2 flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <div className="eyebrow-label">Jornada ate o topo</div>
          <div className="text-xs font-semibold tabular-nums" style={{ color }}>{fmtPct(calc.pctMeta)}</div>
        </div>
        <CommissionProgress
          semCard
          color={color}
          rules={rules}
          pctMeta={calc.pctMeta}
          avatarUrl={seller.avatar_url}
          avatarInitial={seller.name.trim().charAt(0).toUpperCase() || "?"}
          avatarColor={seller.avatar_color || color}
        />
        {/* A tabela abre POR CIMA do card (absoluta): antes ela empurrava a altura da
            linha inteira e, ao fechar, o grafico da esquerda nao encolhia de volta, entao
            a montanha ficava maior do que antes de abrir. */}
        <details className="group relative border-t border-[var(--hair)] pt-2">
          <summary className="cursor-pointer list-none rounded px-1 outline-none focus-visible:ring-1 focus-visible:ring-accent/60 font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-white/50 hover:text-white">
            <span className="group-open:hidden">Ver tabela de comissao ›</span>
            <span className="hidden group-open:inline">Esconder tabela</span>
          </summary>
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-panel p-3 shadow-glow">
            <TabelaFaixas rules={rules} calc={calc} realizado={realizado} meta={meta} color={color} />
            {rules.notes && <p className="mt-2 text-xs text-white/50"><b>Regras:</b> {rules.notes}</p>}
          </div>
        </details>
      </div>

      <Podio bu={bu} rules={rules} buBonus={buBonus} myPodium={myPodium} color={color} />
    </section>
  );
}

function TabelaFaixas({
  rules,
  calc,
  realizado,
  meta,
  color,
}: {
  rules: CommissionRules;
  calc: ReturnType<typeof calcCommission>;
  realizado: number;
  meta: number;
  color: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-[11px] uppercase tracking-wider text-white/40">
        <tr className="text-left">
          <th className="py-1.5">% da meta</th>
          <th className="py-1.5">Comissao</th>
          <th className="py-1.5 text-right max-sm:hidden">No seu faturamento</th>
          <th className="py-1.5 text-right">Status</th>
        </tr>
      </thead>
      <tbody>
        {rules.tiers.map((t) => {
          const reached = calc.tier && t.meta_pct <= calc.tier.meta_pct;
          const isCurrent = calc.tier?.meta_pct === t.meta_pct;
          return (
            <tr key={t.meta_pct} className={`border-t border-[var(--hair)] ${isCurrent ? "bg-accent/5" : ""}`}>
              <td className="py-1.5 font-semibold">{t.meta_pct}%</td>
              <td className="py-1.5 font-semibold" style={{ color: reached ? color : undefined }}>{pctBR(t.commission_pct)}%</td>
              <td className="py-1.5 text-right text-white/70 max-sm:hidden">{BRL.format((t.commission_pct / 100) * calc.baseComissao)}</td>
              <td className="py-1.5 text-right">
                {isCurrent ? (
                  <span className="chip whitespace-nowrap" style={{ background: color + "22", color }}>
                    <Flame className="w-3 h-3" /> Voce esta aqui
                  </span>
                ) : reached ? (
                  <span className="chip" style={{ background: COLOR.ok + "22", color: COLOR.ok }}>Batido</span>
                ) : (
                  <span className="text-xs text-white/40">Faltam {BRL.format(Math.max(0, (t.meta_pct / 100) * meta - realizado))}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Podio({
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
  const medalhas = ["#eab308", "#ada99b", "#b45309"];
  const valores = [rules.top1_bonus, rules.top2_bonus, rules.top3_bonus];
  return (
    <div
      className="panel px-4 py-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
      style={{ borderColor: buBonus.unlocked ? COLOR.ok + "55" : undefined }}
    >
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="eyebrow-label">Bonus do podio</div>
          <div className="text-[11px] text-white/50">
            Coletiva <b style={{ color: buBonus.unlocked ? COLOR.ok : COLOR.mute }}>{fmtPct(buBonus.pctColetivo)}</b> / {buBonus.unlockedAt.toFixed(0)}%
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {valores.map((v, i) => (
            <div key={i} className={`rounded-lg border px-1.5 py-1.5 ${buBonus.unlocked ? "border-border bg-panel2" : "border-border/60 bg-panel2/40"}`}>
              <div className="text-[10px] uppercase tracking-wider text-white/50">Top {i + 1}</div>
              <div className="truncate text-[13px] font-bold" style={{ color: buBonus.unlocked ? medalhas[i] : "#64748b" }}>{BRL.format(v)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-panel2/40 px-3 py-2 sm:w-44">
        <div className="text-[10px] uppercase tracking-wider text-white/40">Sua posicao · {BU_LABEL[bu]}</div>
        {myPodium ? (
          <>
            <div className="font-display text-lg font-bold leading-tight" style={{ color: buBonus.unlocked ? COLOR.ok : color }}>{myPodium.position}o lugar</div>
            <div className="text-[11px] text-white/60">
              {buBonus.unlocked ? <>+ <b style={{ color: COLOR.ok }}>{BRL.format(myPodium.bonus)}</b> garantidos</> : <>Libera com {buBonus.unlockedAt.toFixed(0)}% da BU</>}
            </div>
          </>
        ) : (
          <div className="text-[13px] text-white/70">Fora do top 3</div>
        )}
      </div>
    </div>
  );
}
