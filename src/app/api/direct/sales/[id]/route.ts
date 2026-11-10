import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { CPPEM_PRODUCT_IDS, UNICIVE_PRODUCT_IDS } from "@/lib/products";
import { todayISORecife } from "@/lib/calc";

const CPPEM_IDS = CPPEM_PRODUCT_IDS as unknown as string[];
const UNI_IDS = UNICIVE_PRODUCT_IDS as unknown as string[];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const b = await req.json();
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  // Precisamos saber o canal final pra validar product_line — se veio no
  // patch, usa esse; senao le do banco.
  let effectiveChannel: "direto" | "ia" | null = null;
  if (b.channel === "direto" || b.channel === "ia") {
    effectiveChannel = b.channel;
    patch.channel = b.channel;
  }
  if (effectiveChannel === null) {
    const { data: cur } = await supabaseAdmin
      .from("direct_sales")
      .select("channel")
      .eq("id", params.id)
      .maybeSingle();
    effectiveChannel = ((cur as any)?.channel === "ia" ? "ia" : "direto");
  }
  if (typeof b.sale_date === "string") {
    if (b.sale_date > todayISORecife()) {
      return NextResponse.json(
        { error: "Data da venda nao pode ser no futuro." },
        { status: 400 }
      );
    }
    patch.sale_date = b.sale_date;
  }
  if (typeof b.product_line === "string") {
    if (effectiveChannel === "direto" && !CPPEM_IDS.includes(b.product_line)) {
      return NextResponse.json({ error: "Canal Direto so aceita categorias CPPEM." }, { status: 400 });
    }
    if (effectiveChannel === "ia" && !CPPEM_IDS.includes(b.product_line) && !UNI_IDS.includes(b.product_line)) {
      return NextResponse.json({ error: "Canal IA so aceita categorias CPPEM ou UNICIVE." }, { status: 400 });
    }
    patch.product_line = b.product_line;
  }
  if (b.valor !== undefined) patch.valor = Number(b.valor);
  if (b.quantidade !== undefined) patch.quantidade = Number(b.quantidade);
  if (b.observacao !== undefined) patch.observacao = b.observacao;
  const { error } = await supabaseAdmin.from("direct_sales").update(patch).eq("id", params.id).eq("origem", "manual");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const { error } = await supabaseAdmin.from("direct_sales").delete().eq("id", params.id).eq("origem", "manual");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
