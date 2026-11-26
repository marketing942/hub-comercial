import { supabaseAdmin } from "./supabase";
import type { BU } from "./products";

// =====================================================
// Regras / tiers de comissao (editaveis pelo admin)
// =====================================================
export type CommissionTier = {
  meta_pct: number;      // ex: 80, 90, 100 ...
  commission_pct: number;// ex: 2, 2.5, 3 ...
};

export type CommissionRules = {
  bu: BU;
  min_meta_pct: number;         // comissao so a partir desse % da meta ind.
  /** Legado: a opcao "acumulativa" saiu em 26/11/2026; o calculo usa SEMPRE a maior faixa atingida. */
  cumulative: boolean;
  /** Comissao depois de impostos (26/11/2026): a % incide sobre o faturamento MENOS `tax_pct`. Padrao: desligada. */
  after_tax: boolean;
  /** % media de impostos da empresa, usada quando `after_tax` esta ligada. */
  tax_pct: number;
  bu_bonus_extra_pct: number;   // % acima da meta coletiva pra destravar podio
  top1_bonus: number;
  top2_bonus: number;
  top3_bonus: number;
  notes?: string | null;
  tiers: CommissionTier[];
};

const DEFAULT_TIERS_CPPEM: CommissionTier[] = [
  { meta_pct: 80, commission_pct: 2 },
  { meta_pct: 90, commission_pct: 2.5 },
  { meta_pct: 100, commission_pct: 3 },
  { meta_pct: 110, commission_pct: 3.5 },
  { meta_pct: 120, commission_pct: 4 },
];
const DEFAULT_TIERS_UNIVE: CommissionTier[] = [
  { meta_pct: 80, commission_pct: 6 },
  { meta_pct: 90, commission_pct: 8 },
  { meta_pct: 100, commission_pct: 11 },
  { meta_pct: 120, commission_pct: 14 },
  { meta_pct: 140, commission_pct: 16 },
];

export function defaultRulesFor(bu: BU): CommissionRules {
  return {
    bu,
    min_meta_pct: 80,
    cumulative: false,
    after_tax: false,
    tax_pct: 0,
    bu_bonus_extra_pct: 10,
    top1_bonus: 300,
    top2_bonus: 200,
    top3_bonus: 100,
    notes: null,
    tiers: bu === "cppem" ? DEFAULT_TIERS_CPPEM : DEFAULT_TIERS_UNIVE,
  };
}

export async function loadCommissionRules(): Promise<Record<BU, CommissionRules>> {
  const BASE = "bu, min_meta_pct, cumulative, bu_bonus_extra_pct, top1_bonus, top2_bonus, top3_bonus, notes";
  const lerRegras = async () => {
    // Colunas de imposto (supabase/commission-impostos.sql) podem ainda nao existir:
    // sem elas, cai no select antigo e a opcao fica desligada.
    const r = await supabaseAdmin.from("commission_rules").select(`${BASE}, after_tax, tax_pct`);
    if (!r.error) return r;
    return supabaseAdmin.from("commission_rules").select(BASE);
  };
  const [{ data: rulesRows }, { data: tierRows }] = await Promise.all([
    lerRegras(),
    supabaseAdmin
      .from("commission_tiers")
      .select("bu, meta_pct, commission_pct")
      .order("meta_pct", { ascending: true }),
  ]);

  const bus: BU[] = ["cppem", "unicive", "colegio_cppem"];
  const map = {} as Record<BU, CommissionRules>;
  for (const bu of bus) {
    const r = (rulesRows || []).find((x: any) => x.bu === bu);
    const tiers = ((tierRows || []) as any[])
      .filter((t) => t.bu === bu)
      .map((t) => ({ meta_pct: Number(t.meta_pct), commission_pct: Number(t.commission_pct) }))
      .sort((a, b) => a.meta_pct - b.meta_pct);
    if (r) {
      map[bu] = {
        bu,
        min_meta_pct: Number(r.min_meta_pct ?? 80),
        cumulative: false,
        after_tax: Boolean((r as any).after_tax),
        tax_pct: Math.min(100, Math.max(0, Number((r as any).tax_pct ?? 0))),
        bu_bonus_extra_pct: Number(r.bu_bonus_extra_pct ?? 10),
        top1_bonus: Number(r.top1_bonus ?? 300),
        top2_bonus: Number(r.top2_bonus ?? 200),
        top3_bonus: Number(r.top3_bonus ?? 100),
        notes: r.notes ?? null,
        tiers: tiers.length > 0 ? tiers : defaultRulesFor(bu).tiers,
      };
    } else {
      map[bu] = { ...defaultRulesFor(bu), tiers: tiers.length > 0 ? tiers : defaultRulesFor(bu).tiers };
    }
  }
  return map;
}

// =====================================================
// Calculo por vendedor
// =====================================================
export type CommissionCalc = {
  meta: number;               // R$
  realizado: number;          // R$
  pctMeta: number;            // 0..∞
  tier: CommissionTier | null;// tier atingido (o mais alto)
  commissionPct: number;      // % da faixa atingida (a maior; nunca soma faixas)
  commissionValue: number;    // R$
  /** Sobre o que a % incide: o realizado, ou o realizado menos impostos (`after_tax`). */
  baseComissao: number;
  nextTier: CommissionTier | null;   // proximo tier acima do atual
  toNextTier: number;         // R$ pra chegar no proximo tier
};

export function calcCommission(
  realizado: number,
  meta: number,
  rules: CommissionRules
): CommissionCalc {
  const sorted = [...rules.tiers].sort((a, b) => a.meta_pct - b.meta_pct);
  // A faixa e decidida pelo % da meta (realizado bruto); a % de comissao incide
  // sobre a base — bruta, ou liquida de impostos quando a opcao esta ligada.
  const baseComissao = rules.after_tax ? realizado * (1 - Math.min(100, Math.max(0, rules.tax_pct)) / 100) : realizado;
  const empty: CommissionCalc = {
    baseComissao,
    meta,
    realizado,
    pctMeta: 0,
    tier: null,
    commissionPct: 0,
    commissionValue: 0,
    nextTier: sorted[0] || null,
    toNextTier: sorted[0] && meta > 0 ? Math.max(0, (sorted[0].meta_pct / 100) * meta - realizado) : 0,
  };
  if (meta <= 0) return empty;
  const pct = (realizado / meta) * 100;
  const belowMin = pct < rules.min_meta_pct;

  let matched: CommissionTier | null = null;
  let effectivePct = 0;
  for (const t of sorted) {
    if (pct >= t.meta_pct) {
      matched = t;
      effectivePct = t.commission_pct;
    }
  }

  if (belowMin || !matched) {
    // proximo tier = primeiro acima do min_meta_pct que ainda nao atingiu
    const next = sorted.find((t) => t.meta_pct > pct) || null;
    return {
      baseComissao,
      meta,
      realizado,
      pctMeta: pct,
      tier: null,
      commissionPct: 0,
      commissionValue: 0,
      nextTier: next,
      toNextTier: next ? Math.max(0, (next.meta_pct / 100) * meta - realizado) : 0,
    };
  }

  const commissionValue = (effectivePct / 100) * baseComissao;
  const nextTier = sorted.find((t) => t.meta_pct > matched!.meta_pct) || null;
  const toNextTier = nextTier ? Math.max(0, (nextTier.meta_pct / 100) * meta - realizado) : 0;
  return {
    baseComissao,
    meta,
    realizado,
    pctMeta: pct,
    tier: matched,
    commissionPct: effectivePct,
    commissionValue,
    nextTier,
    toNextTier,
  };
}

// =====================================================
// Bonus coletivo (podio da BU)
// =====================================================
export type BUBonus = {
  sumMeta: number;
  sumRealizado: number;
  pctColetivo: number;
  unlocked: boolean;                 // pctColetivo >= 100 + bu_bonus_extra_pct
  unlockedAt: number;                // 100 + bu_bonus_extra_pct
  ranking: { sellerId: string; realizado: number; bonus: number; position: number }[];
};

export function rankBUBonus(
  sellers: { sellerId: string; realizado: number; meta: number }[],
  rules: CommissionRules
): BUBonus {
  const sumMeta = sellers.reduce((a, s) => a + Math.max(0, s.meta), 0);
  const sumRealizado = sellers.reduce((a, s) => a + Math.max(0, s.realizado), 0);
  const pctColetivo = sumMeta > 0 ? (sumRealizado / sumMeta) * 100 : 0;
  const unlockedAt = 100 + rules.bu_bonus_extra_pct;
  const unlocked = sumMeta > 0 && pctColetivo >= unlockedAt;
  const sortedByReal = [...sellers].sort((a, b) => b.realizado - a.realizado);
  const bonuses = [rules.top1_bonus, rules.top2_bonus, rules.top3_bonus];
  const ranking = sortedByReal.slice(0, 3).map((s, i) => ({
    sellerId: s.sellerId,
    realizado: s.realizado,
    position: i + 1,
    bonus: unlocked ? bonuses[i] || 0 : 0,
  }));
  return { sumMeta, sumRealizado, pctColetivo, unlocked, unlockedAt, ranking };
}
