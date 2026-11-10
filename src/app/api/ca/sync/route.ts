import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { reprocessar } from "@/lib/ca/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reprocessa o espelho local: descobre pendencias e renormaliza a janela.
 *
 * NAO busca nada do Conta Azul — quem traz o dado e o Jarvis, empurrando para
 * /api/ca/receber. Este botao existe para ver o efeito de uma classificacao
 * recem-feita sem esperar o proximo empurrao.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { de?: string; ate?: string };
  try {
    return NextResponse.json({ ok: true, ...(await reprocessar({ de: body.de, ate: body.ate })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
