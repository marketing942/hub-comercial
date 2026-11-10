import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const DESTINOS = new Set(["vendedor", "canal_direto", "grupo", "pendente"]);

/** Liga um cadastro de vendedor do Conta Azul a um vendedor do Hub. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });

  const b = (await req.json()) as { ca_vendedor_id?: string; destino?: string; seller_id?: string | null };
  if (!b.ca_vendedor_id) return NextResponse.json({ error: "ca_vendedor_id obrigatorio." }, { status: 400 });
  if (!b.destino || !DESTINOS.has(b.destino)) return NextResponse.json({ error: "destino invalido." }, { status: 400 });

  // `vendedor` sem seller_id creditaria ninguem e a venda sumiria do ranking
  // sem aviso — recusa explicita e melhor que um silencio.
  if (b.destino === "vendedor" && !b.seller_id) {
    return NextResponse.json({ error: "Escolha o vendedor do Hub para o destino 'vendedor'." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("ca_vendedores")
    .update({ destino: b.destino, seller_id: b.destino === "vendedor" ? b.seller_id : null })
    .eq("ca_vendedor_id", b.ca_vendedor_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
