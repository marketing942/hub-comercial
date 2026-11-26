import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sessionCookie } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";

// Login unificado: recebe apenas { password }. O sistema identifica
// se e admin OU algum vendedor pela chave digitada.
//
// Ordem:
//   1) ADMIN_PASSWORD do env -> role=admin
//   2) SUPERVISOR_PASSWORD do env (opcional) -> role=supervisor (TVs do comercial)
//   3) procura em sellers ativos com password_hash setado -> role=seller
//   3) 401
//
// SELLER_PASSWORD do env NAO e mais usado — cada vendedor tem sua
// propria senha, definida pelo admin ou pelo proprio em "Minha senha".

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Informe a chave de acesso." }, { status: 400 });
  }

  const admin = process.env.ADMIN_PASSWORD;
  if (!admin) {
    return NextResponse.json(
      { error: "Servidor sem ADMIN_PASSWORD configurado." },
      { status: 500 }
    );
  }

  // Caminho rapido: admin
  if (safeEqual(password, admin)) {
    const res = NextResponse.json({ ok: true, role: "admin" });
    res.cookies.set(await sessionCookie({ role: "admin" }));
    return res;
  }

  // Supervisor comercial: chave unica do env (opcional; sem ela, o nivel nao existe).
  const supervisor = process.env.SUPERVISOR_PASSWORD;
  if (supervisor && safeEqual(password, supervisor)) {
    const res = NextResponse.json({ ok: true, role: "supervisor" });
    res.cookies.set(await sessionCookie({ role: "supervisor" }));
    return res;
  }

  // Caminho vendedor: busca ativos com hash e testa um a um.
  const { data: rows } = await supabaseAdmin
    .from("sellers")
    .select("id, password_hash")
    .eq("active", true)
    .not("password_hash", "is", null);

  for (const r of (rows as any[]) || []) {
    const ok = await verifyPassword(password, r.password_hash);
    if (ok) {
      const res = NextResponse.json({ ok: true, role: "seller", sellerId: r.id });
      res.cookies.set(await sessionCookie({ role: "seller", sellerId: r.id }));
      return res;
    }
  }

  return NextResponse.json({ error: "Chave de acesso invalida." }, { status: 401 });
}
