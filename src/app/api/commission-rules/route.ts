import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { loadCommissionRules } from "@/lib/commission";
import type { BU } from "@/lib/products";

// GET — devolve todas as regras (por BU). Qualquer logado ve.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const rules = await loadCommissionRules();
  return NextResponse.json({ rules });
}

// POST — apenas admin. Body: { bu, min_meta_pct?, after_tax?, tax_pct?, bu_bonus_extra_pct?,
//                              top1_bonus?, top2_bonus?, top3_bonus?, notes?, tiers?: [{meta_pct, commission_pct}] }
export async function POST(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const bu = body?.bu as BU;
  if (!bu || !["cppem", "unicive", "colegio_cppem"].includes(bu)) {
    return NextResponse.json({ error: "BU invalida." }, { status: 400 });
  }

  const rulesPayload: Record<string, any> = { bu };
  if (body.min_meta_pct !== undefined) rulesPayload.min_meta_pct = Math.max(0, Number(body.min_meta_pct));
  // "Acumulativa entre faixas" saiu (26/11/2026): grava sempre desligada.
  rulesPayload.cumulative = false;
  const impostos: Record<string, unknown> = {};
  if (body.after_tax !== undefined) impostos.after_tax = Boolean(body.after_tax);
  if (body.tax_pct !== undefined) impostos.tax_pct = Math.min(100, Math.max(0, Number(body.tax_pct) || 0));
  if (body.bu_bonus_extra_pct !== undefined) rulesPayload.bu_bonus_extra_pct = Math.max(0, Number(body.bu_bonus_extra_pct));
  if (body.top1_bonus !== undefined) rulesPayload.top1_bonus = Math.max(0, Number(body.top1_bonus));
  if (body.top2_bonus !== undefined) rulesPayload.top2_bonus = Math.max(0, Number(body.top2_bonus));
  if (body.top3_bonus !== undefined) rulesPayload.top3_bonus = Math.max(0, Number(body.top3_bonus));
  if (body.notes !== undefined) rulesPayload.notes = body.notes ? String(body.notes).slice(0, 500) : null;
  rulesPayload.updated_at = new Date().toISOString();

  let { error: rulesErr } = await supabaseAdmin
    .from("commission_rules")
    .upsert({ ...rulesPayload, ...impostos }, { onConflict: "bu" });
  // Sem as colunas de imposto no banco: grava o resto e avisa.
  let avisoImpostos: string | null = null;
  if (rulesErr && Object.keys(impostos).length > 0 && /after_tax|tax_pct/.test(rulesErr.message)) {
    ({ error: rulesErr } = await supabaseAdmin.from("commission_rules").upsert(rulesPayload, { onConflict: "bu" }));
    avisoImpostos = "Rode supabase/commission-impostos.sql no Supabase para salvar a opcao de impostos.";
  }
  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

  if (Array.isArray(body.tiers)) {
    const clean = body.tiers
      .map((t: any) => ({
        bu,
        meta_pct: Number(t.meta_pct),
        commission_pct: Number(t.commission_pct),
      }))
      .filter((t: any) => Number.isFinite(t.meta_pct) && Number.isFinite(t.commission_pct));

    // Substitui os tiers dessa BU pelo conteudo novo.
    const { error: delErr } = await supabaseAdmin
      .from("commission_tiers")
      .delete()
      .eq("bu", bu);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (clean.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("commission_tiers")
        .insert(clean);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, aviso: avisoImpostos });
}
