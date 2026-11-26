// Leitura das matriculas do Colegio (SERVIDOR). Calculo em lib/colegioMatriculas.ts.
import { supabaseAdmin } from "./supabase";
import { ANO_LETIVO, gradeVazia, normalizarLinha, type GradeColegio } from "./colegioMatriculas";

export type CargaColegio = { grade: GradeColegio; atualizadoEm: string | null; semTabela: boolean };

/** Nunca lanca: sem a tabela (SQL ainda nao rodado) devolve vazio + `semTabela`. */
export async function carregarMatriculas(ano: number = ANO_LETIVO): Promise<CargaColegio> {
  const grade = gradeVazia();
  const { data, error } = await supabaseAdmin
    .from("colegio_matriculas")
    .select("serie, alunos_hoje, rematriculas, desistencias, novas, updated_at")
    .eq("ano", ano);
  if (error) {
    console.warn("carregarMatriculas falhou (tabela colegio_matriculas existe?):", error.message);
    return { grade, atualizadoEm: null, semTabela: true };
  }
  let atualizadoEm: string | null = null;
  for (const r of (data as any[]) || []) {
    if (!grade[r.serie]) continue;
    grade[r.serie] = normalizarLinha(r.serie, r);
    if (r.updated_at && (!atualizadoEm || r.updated_at > atualizadoEm)) atualizadoEm = r.updated_at;
  }
  return { grade, atualizadoEm, semTabela: false };
}
