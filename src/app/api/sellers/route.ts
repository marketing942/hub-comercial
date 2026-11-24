import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { nomeDoCA } from "@/lib/ca/nomes";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("sellers").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

function sanitizeBus(input: any, fallbackBu: string): string[] {
  const raw = Array.isArray(input) ? input : [];
  const clean = raw.filter(
    (x) => x === "cppem" || x === "unicive" || x === "colegio_cppem"
  );
  if (clean.length > 0) return Array.from(new Set(clean));
  if (fallbackBu === "cppem" || fallbackBu === "unicive" || fallbackBu === "colegio_cppem") {
    return [fallbackBu];
  }
  return [];
}

export async function POST(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const body = await req.json();
  // O vendedor nasce de um cadastro do Conta Azul: o NOME vem de la (nao se digita).
  const { ca_vendedor_id, bu, bus, avatar_color } = body || {};
  const cleanBus = sanitizeBus(bus, bu);
  if (!ca_vendedor_id || cleanBus.length === 0) {
    return NextResponse.json({ error: "Escolha o vendedor do Conta Azul e ao menos uma BU." }, { status: 400 });
  }
  const { data: ca } = await supabaseAdmin
    .from("ca_vendedores")
    .select("ca_vendedor_id, ca_nome, seller_id")
    .eq("ca_vendedor_id", ca_vendedor_id)
    .maybeSingle();
  const name = nomeDoCA((ca as { ca_nome?: string | null } | null)?.ca_nome);
  if (!ca || !name) return NextResponse.json({ error: "Vendedor do Conta Azul nao encontrado." }, { status: 404 });
  if ((ca as { seller_id?: string | null }).seller_id) {
    return NextResponse.json({ error: "Esse vendedor do Conta Azul ja esta ligado a um vendedor do Hub." }, { status: 409 });
  }
  const { data, error } = await supabaseAdmin
    .from("sellers")
    .insert({
      name,
      bu: cleanBus[0],
      bus: cleanBus,
      avatar_color: avatar_color || "#22c55e",
      // Explicito pra nao depender de DEFAULT do banco (em DBs antigos o
      // default pode nao estar setado, o que fazia o vendedor entrar com
      // active=NULL e sumir do /escolher-vendedor).
      active: true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Liga o cadastro do CA ao vendedor novo: as vendas dele passam a creditar aqui.
  const lig = await supabaseAdmin
    .from("ca_vendedores")
    .update({ destino: "vendedor", seller_id: (data as { id: string }).id })
    .eq("ca_vendedor_id", ca_vendedor_id);
  if (lig.error) return NextResponse.json({ error: `Vendedor criado, mas a ligacao com o Conta Azul falhou: ${lig.error.message}` }, { status: 500 });
  revalidatePath("/admin/sellers");
  return NextResponse.json({ data });
}
