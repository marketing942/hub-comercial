import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { CPPEM_PRODUCT_IDS, UNICIVE_PRODUCT_IDS } from "@/lib/products";
import { todayISORecife } from "@/lib/calc";

const CPPEM_IDS = CPPEM_PRODUCT_IDS as unknown as string[];
const UNI_IDS = UNICIVE_PRODUCT_IDS as unknown as string[];

// POST /api/direct/sales { sale_date, product_line, valor, quantidade, observacao?, channel? }
// channel = 'direto' (default, so CPPEM) ou 'ia' (CPPEM ou UNICIVE)
export async function POST(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") {
    return NextResponse.json({ error: "Apenas admin lanca venda do direto/IA." }, { status: 401 });
  }
  const b = await req.json();
  const { sale_date, product_line, valor, quantidade, observacao } = b || {};
  const channel: "direto" | "ia" = b?.channel === "ia" ? "ia" : "direto";
  if (!sale_date || !product_line) {
    return NextResponse.json({ error: "Faltam sale_date / product_line." }, { status: 400 });
  }
  // Guarda: nao aceita venda com data no futuro (fuso de Recife).
  if (typeof sale_date === "string" && sale_date > todayISORecife()) {
    return NextResponse.json(
      { error: "Data da venda nao pode ser no futuro." },
      { status: 400 }
    );
  }
  // Direto: so CPPEM. IA: CPPEM ou UNICIVE.
  if (channel === "direto" && !CPPEM_IDS.includes(product_line)) {
    return NextResponse.json({ error: "Canal Direto so aceita categorias CPPEM." }, { status: 400 });
  }
  if (channel === "ia" && !CPPEM_IDS.includes(product_line) && !UNI_IDS.includes(product_line)) {
    return NextResponse.json({ error: "Canal IA so aceita categorias CPPEM ou UNICIVE." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("direct_sales")
    .insert({
      sale_date,
      product_line,
      valor: Number(valor || 0),
      quantidade: Number(quantidade || 1),
      observacao: observacao || null,
      channel,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// GET /api/direct/sales?year=&month=
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const u = new URL(req.url);
  const year = Number(u.searchParams.get("year"));
  const month = Number(u.searchParams.get("month"));
  if (!year || !month) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const lastDay = `${next.y}-${String(next.m).padStart(2, "0")}-01`;
  const { data, error } = await supabaseAdmin
    .from("direct_sales")
    .select("*")
    // So o lancamento manual: as linhas do Conta Azul vivem exclusivamente no
    // GAV (/admin/gav). Ver src/lib/fonte.ts.
    .eq("origem", "manual")
    .gte("sale_date", firstDay)
    .lt("sale_date", lastDay)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
