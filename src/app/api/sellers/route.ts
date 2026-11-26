import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("sellers").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Nunca devolve o hash da senha (qualquer sessao logada le esta rota, inclusive TVs).
  const limpos = (data || []).map(({ password_hash, ...resto }: Record<string, unknown>) => ({
    ...resto,
    has_password: Boolean(password_hash),
  }));
  return NextResponse.json({ data: limpos });
}

// Nao existe criar vendedor aqui (26/11/2026): ele nasce do cadastro do Conta Azul,
// em POST /api/ca/vendedores.
