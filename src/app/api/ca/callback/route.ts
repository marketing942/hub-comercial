import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { salvarToken } from "@/lib/ca/client";
import { CA_ENV, CA_OAUTH, caConfigurado } from "@/lib/ca/config";

export const dynamic = "force-dynamic";

/** Callback do OAuth: troca o `code` pelo par de tokens e guarda no banco. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });
  if (!caConfigurado()) return NextResponse.json({ error: "Conta Azul não configurado." }, { status: 500 });

  const code = new URL(req.url).searchParams.get("code");
  const destino = new URL("/admin/gav/conexao", CA_ENV.redirectUri);
  if (!code) {
    destino.searchParams.set("erro", "sem-code");
    return NextResponse.redirect(destino.toString());
  }

  const basic = Buffer.from(`${CA_ENV.clientId}:${CA_ENV.clientSecret}`).toString("base64");
  const res = await fetch(CA_OAUTH.tokenUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CA_ENV.redirectUri,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    destino.searchParams.set("erro", `token-${res.status}`);
    return NextResponse.redirect(destino.toString());
  }

  await salvarToken(await res.json(), { por: "admin" });
  destino.searchParams.set("ok", "1");
  return NextResponse.redirect(destino.toString());
}
