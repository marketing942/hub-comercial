import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ALL_BUS, type BU } from "@/lib/products";
import { YEAR_MAX, YEAR_MIN } from "@/lib/yearMath";

// POST /api/year { bu, year, month, receita, qtd, leads_pago, leads_organico }
// Grava (upsert) os totais de UM mes de uma BU na aba Ano. So admin.
export async function POST(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });

  const b = await req.json().catch(() => null);
  const bu = b?.bu as BU;
  const year = Number(b?.year);
  const month = Number(b?.month);
  if (!ALL_BUS.includes(bu)) {
    return NextResponse.json({ error: "BU invalida." }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
    return NextResponse.json({ error: "Ano invalido." }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Mes invalido." }, { status: 400 });
  }

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const row = {
    bu,
    year,
    month,
    receita: Math.round(num(b?.receita) * 100) / 100,
    qtd: Math.round(num(b?.qtd)),
    leads_pago: Math.round(num(b?.leads_pago)),
    leads_organico: Math.round(num(b?.leads_organico)),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("year_realizado")
    .upsert(row, { onConflict: "bu,year,month" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
