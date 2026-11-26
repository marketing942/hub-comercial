import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { nomeDoCA } from "@/lib/ca/nomes";

const DESTINOS = new Set(["vendedor", "canal_direto", "grupo", "pendente"]);
const BUS = new Set(["cppem", "unicive", "colegio_cppem"]);

const chave = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

type Registro = { ca_vendedor_id: string; ca_nome: string | null; destino: string; seller_id: string | null };

/**
 * Destino de cadastro(s) de vendedor do Conta Azul (Configuracoes -> Vendedores,
 * 26/11/2026: nao se cria mais vendedor a mao — ele nasce daqui).
 *
 * POST { ca_vendedor_ids: string[], destino, bus?: string[], seller_id?: string }
 *  - "vendedor": usa o vendedor do Hub ja lembrado no cadastro (reativa), ou o
 *    indicado em `seller_id` (cadastro duplicado da mesma pessoa), ou um com o
 *    mesmo nome; se nao houver nenhum, CRIA com as `bus` informadas.
 *  - outro destino: o vendedor do Hub NAO e apagado (historico, metas e senha
 *    ficam); se nenhum cadastro "vendedor" aponta mais para ele, fica inativo. O
 *    `seller_id` continua no cadastro como memoria (a normalizacao so o usa
 *    quando o destino e "vendedor").
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { ca_vendedor_ids?: string[]; destino?: string; bus?: string[]; seller_id?: string };
  const ids = Array.isArray(b.ca_vendedor_ids) ? b.ca_vendedor_ids.filter((x) => typeof x === "string" && x) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Cadastro do Conta Azul obrigatorio." }, { status: 400 });
  if (!b.destino || !DESTINOS.has(b.destino)) return NextResponse.json({ error: "destino invalido." }, { status: 400 });
  const falha = (m: string, status = 500) => NextResponse.json({ error: m }, { status });

  const lidos = await supabaseAdmin.from("ca_vendedores").select("ca_vendedor_id, ca_nome, destino, seller_id").in("ca_vendedor_id", ids);
  if (lidos.error) return falha(lidos.error.message);
  const regs = (lidos.data || []) as Registro[];
  if (regs.length === 0) return falha("Cadastro nao encontrado no Conta Azul.", 404);

  if (b.destino !== "vendedor") {
    const up = await supabaseAdmin.from("ca_vendedores").update({ destino: b.destino }).in("ca_vendedor_id", ids);
    if (up.error) return falha(up.error.message);
    for (const sellerId of new Set(regs.map((r) => r.seller_id).filter(Boolean) as string[])) {
      const resta = await supabaseAdmin.from("ca_vendedores").select("ca_vendedor_id").eq("seller_id", sellerId).eq("destino", "vendedor").limit(1);
      if (resta.error) return falha(resta.error.message);
      if (!resta.data?.length) {
        const off = await supabaseAdmin.from("sellers").update({ active: false }).eq("id", sellerId);
        if (off.error) return falha(off.error.message);
      }
    }
    revalidatePath("/admin/sellers");
    return NextResponse.json({ ok: true });
  }

  const nome = nomeDoCA(regs[0].ca_nome);
  const bus = Array.from(new Set((b.bus || []).filter((x) => BUS.has(x))));
  const lembrado = regs.find((r) => r.seller_id)?.seller_id ?? null;
  let sellerId: string | null = b.seller_id || lembrado;

  if (!sellerId && nome) {
    const todos = await supabaseAdmin.from("sellers").select("id, name");
    if (todos.error) return falha(todos.error.message);
    sellerId = (todos.data || []).find((x: { name: string }) => chave(x.name) === chave(nome))?.id ?? null;
  }

  if (!sellerId) {
    if (!nome) return falha("Este cadastro esta sem nome no Conta Azul.", 400);
    if (bus.length === 0) return falha("Escolha a BU do vendedor.", 400);
    const novo = await supabaseAdmin
      .from("sellers")
      .insert({ name: nome, bu: bus[0], bus, avatar_color: "#22c55e", active: true })
      .select("id")
      .single();
    if (novo.error) return falha(novo.error.message);
    sellerId = (novo.data as { id: string }).id;
  } else {
    // Quem esta voltando a ser vendedor pelo proprio cadastro volta ativo.
    // Juntar um cadastro duplicado (`seller_id`) nao mexe no status.
    const patch: Record<string, unknown> = {};
    if (!b.seller_id) patch.active = true;
    if (bus.length > 0) {
      patch.bus = bus;
      patch.bu = bus[0];
    }
    if (Object.keys(patch).length > 0) {
      const up = await supabaseAdmin.from("sellers").update(patch).eq("id", sellerId);
      if (up.error) return falha(up.error.message);
    }
  }

  const lig = await supabaseAdmin.from("ca_vendedores").update({ destino: "vendedor", seller_id: sellerId }).in("ca_vendedor_id", ids);
  if (lig.error) return falha(lig.error.message);
  revalidatePath("/admin/sellers");
  return NextResponse.json({ ok: true, seller_id: sellerId });
}
