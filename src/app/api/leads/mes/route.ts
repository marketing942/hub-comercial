import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Leads por MES (desde 26/11/2026): o admin informa so o TOTAL do mes ate agora
 * de cada vendedor, em vez de lancar dia a dia. Continua em `daily_leads` (o resto
 * do sistema soma o mes): o total vira UMA linha no dia 1 do mes e as linhas
 * diarias antigas daquele mes sao apagadas. Assim nada que le leads muda.
 */
function faixa(year: number, month: number) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const n = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { first, next: `${n.y}-${String(n.m).padStart(2, "0")}-01` };
}

// GET /api/leads/mes?year=&month=  -> { totais: { [seller_id]: qty } }
export async function GET(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const u = new URL(req.url);
  const year = Number(u.searchParams.get("year"));
  const month = Number(u.searchParams.get("month"));
  if (!year || !month || month < 1 || month > 12) return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  const { first, next } = faixa(year, month);
  const { data, error } = await supabaseAdmin
    .from("daily_leads")
    .select("seller_id, qty")
    .gte("date", first)
    .lt("date", next)
    .range(0, 9999);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const totais: Record<string, number> = {};
  for (const r of data || []) totais[r.seller_id] = (totais[r.seller_id] || 0) + Number(r.qty || 0);
  return NextResponse.json({ totais }, { headers: { "cache-control": "no-store" } });
}

// PUT /api/leads/mes { year, month, totais: { [seller_id]: qty } }
export async function PUT(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const year = Number(body?.year);
  const month = Number(body?.month);
  const totais = body?.totais as Record<string, unknown> | undefined;
  if (!year || !month || month < 1 || month > 12 || !totais || typeof totais !== "object") {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }
  const linhas = Object.entries(totais)
    .filter(([id]) => typeof id === "string" && id.length > 0)
    .map(([seller_id, q]) => ({ seller_id, qty: Math.max(0, Math.round(Number(q) || 0)) }));
  if (linhas.length === 0) return NextResponse.json({ ok: true });
  const { first, next } = faixa(year, month);
  const ids = linhas.map((l) => l.seller_id);

  // 1) grava o total no dia 1 (upsert) — 2) so depois apaga os outros dias do mes.
  const up = await supabaseAdmin
    .from("daily_leads")
    .upsert(linhas.map((l) => ({ seller_id: l.seller_id, date: first, qty: l.qty })), { onConflict: "seller_id,date" });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  const del = await supabaseAdmin
    .from("daily_leads")
    .delete()
    .in("seller_id", ids)
    .gt("date", first)
    .lt("date", next);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
