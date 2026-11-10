import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/sales/recent?since=<ISO>
// Devolve vendas criadas depois de `since`, com nome do vendedor e valor.
// Usado pelo dashboard TV pra disparar a notificacao comemorativa.
// Qualquer sessao logada pode ler. Nao retorna PII sensivel — so o
// nome e o valor pra feedback visual/sonoro.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const u = new URL(req.url);
  const since = u.searchParams.get("since");

  // Teto conservador se nao for passado: ultimos 10min.
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 10 * 60 * 1000);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: "since invalido." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("id, seller_id, valor, created_at")
    // So o que foi lancado A MAO. As linhas do Conta Azul (origem =
    // 'conta_azul') existem desde a integracao, mas vivem exclusivamente no GAV
    // (/admin/gav) — nenhuma tela que ja funcionava pode mudar de numero nem
    // mostrar dado novo. Ver src/lib/fonte.ts.
    // Sem isto, a buzina de venda nova tocaria a cada rodada do sync.
    .eq("origem", "manual")
    .gt("created_at", sinceDate.toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as any[]) || [];
  if (rows.length === 0) {
    return NextResponse.json({ sales: [], now: new Date().toISOString() });
  }

  // Resolve nome do vendedor em uma query so.
  const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id)));
  const { data: sellers } = await supabaseAdmin
    .from("sellers")
    .select("id, name")
    .in("id", sellerIds);
  const nameById = new Map<string, string>();
  for (const sl of (sellers as any[]) || []) nameById.set(sl.id, sl.name);

  const sales = rows.map((r) => ({
    id: r.id,
    sellerName: nameById.get(r.seller_id) || "Vendedor",
    valor: Number(r.valor || 0),
    createdAt: r.created_at,
  }));

  return NextResponse.json({ sales, now: new Date().toISOString() });
}
