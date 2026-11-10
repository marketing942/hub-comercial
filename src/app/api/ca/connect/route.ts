import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { CA_ENV, CA_OAUTH, caConfigurado } from "@/lib/ca/config";

/**
 * Inicia o OAuth do Conta Azul. SÓ ADMIN — conectar expõe o faturamento inteiro
 * da empresa à aplicação.
 */
export async function GET() {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });
  if (!caConfigurado()) {
    return NextResponse.json(
      { error: "Faltam CONTA_AZUL_CLIENT_ID, CLIENT_SECRET e REDIRECT_URI no ambiente." },
      { status: 500 },
    );
  }

  const url = new URL(CA_OAUTH.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CA_ENV.clientId);
  // Tem de ser IDÊNTICO ao cadastrado no portal do CA, caractere a caractere.
  url.searchParams.set("redirect_uri", CA_ENV.redirectUri);
  url.searchParams.set("scope", CA_OAUTH.scope);
  // `state` simples: a rota de callback é de admin e o fluxo é manual.
  url.searchParams.set("state", "hub");

  return NextResponse.redirect(url.toString());
}
