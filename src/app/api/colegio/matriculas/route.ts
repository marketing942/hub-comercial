import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ANO_LETIVO, SERIES, erroDaLinha, normalizarLinha } from "@/lib/colegioMatriculas";
import { carregarMatriculas } from "@/lib/colegioMatriculasServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  return NextResponse.json(await carregarMatriculas(), { headers: { "cache-control": "no-store" } });
}

// PUT { grade: { [serie]: { alunos_hoje, rematriculas, desistencias, novas } } } — grava as 12 series.
export async function PUT(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const grade = body?.grade;
  // Exige as 12 series: um envio parcial zeraria as que faltam.
  if (!grade || typeof grade !== "object" || SERIES.some((x) => !grade[x.id])) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  const agora = new Date().toISOString();
  const linhas = [];
  for (const serie of SERIES) {
    const l = normalizarLinha(serie.id, grade[serie.id]);
    const erro = erroDaLinha(serie.id, l);
    if (erro) return NextResponse.json({ error: `${serie.nome}: ${erro}` }, { status: 400 });
    linhas.push({ ano: ANO_LETIVO, serie: serie.id, ...l, updated_at: agora });
  }
  const { error } = await supabaseAdmin.from("colegio_matriculas").upsert(linhas, { onConflict: "ano,serie" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, atualizadoEm: agora });
}
