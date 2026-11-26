/**
 * Matriculas do Colegio para o proximo ano letivo — tipos e CALCULO, puros (sem
 * servidor): a aba Configuracoes -> Colegio e o painel do Colegio usam a MESMA
 * conta. Tudo e digitado pelo time (o Conta Azul nao distingue rematricula de
 * matricula nova: o item e o mesmo, "MATRICULA - 9o Ano").
 *
 * Regras (26/11/2026):
 *  - por serie, sempre o TOTAL ate o momento;
 *  - confirmados para o ano = rematriculas + novas;
 *  - sem resposta = alunos hoje − rematriculas − desistencias (calculado);
 *  - 3o ano do Medio = concluintes: nao rematriculam nem entram em "sem resposta"
 *    (novas matriculas que entram no 3o Medio contam normalmente).
 */
export const ANO_LETIVO = 2027;

export const SERIES = [
  { id: "ef1", nome: "1º ano Fundamental" },
  { id: "ef2", nome: "2º ano Fundamental" },
  { id: "ef3", nome: "3º ano Fundamental" },
  { id: "ef4", nome: "4º ano Fundamental" },
  { id: "ef5", nome: "5º ano Fundamental" },
  { id: "ef6", nome: "6º ano Fundamental" },
  { id: "ef7", nome: "7º ano Fundamental" },
  { id: "ef8", nome: "8º ano Fundamental" },
  { id: "ef9", nome: "9º ano Fundamental" },
  { id: "em1", nome: "1º ano Médio" },
  { id: "em2", nome: "2º ano Médio" },
  { id: "em3", nome: "3º ano Médio", concluinte: true },
] as const;

export type SerieId = (typeof SERIES)[number]["id"];
export const ehConcluinte = (id: string) => id === "em3";

export type LinhaSerie = { alunos_hoje: number; rematriculas: number; desistencias: number; novas: number };
export type GradeColegio = Record<string, LinhaSerie>;

export const linhaVazia = (): LinhaSerie => ({ alunos_hoje: 0, rematriculas: 0, desistencias: 0, novas: 0 });
export const gradeVazia = (): GradeColegio => Object.fromEntries(SERIES.map((s) => [s.id, linhaVazia()]));

const inteiro = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

/** Numeros inteiros >= 0; concluinte nunca tem rematricula nem desistencia. */
export function normalizarLinha(id: string, l: Partial<LinhaSerie> | undefined): LinhaSerie {
  const c = ehConcluinte(id);
  return {
    alunos_hoje: inteiro(l?.alunos_hoje),
    rematriculas: c ? 0 : inteiro(l?.rematriculas),
    desistencias: c ? 0 : inteiro(l?.desistencias),
    novas: inteiro(l?.novas),
  };
}

/** Linha impossivel (mais respostas do que alunos). `null` = ok. */
export function erroDaLinha(id: string, l: LinhaSerie): string | null {
  if (ehConcluinte(id)) return null;
  const respostas = l.rematriculas + l.desistencias;
  if (respostas > l.alunos_hoje) {
    return `Rematrículas + desistências (${respostas}) passam dos alunos de hoje (${l.alunos_hoje}).`;
  }
  return null;
}

export const semRespostaDaLinha = (id: string, l: LinhaSerie) =>
  ehConcluinte(id) ? 0 : Math.max(0, l.alunos_hoje - l.rematriculas - l.desistencias);

export type ResumoColegio = {
  alunosHoje: number;
  concluintes: number;
  /** Quem pode rematricular = alunos hoje − concluintes. */
  elegiveis: number;
  rematriculas: number;
  desistencias: number;
  semResposta: number;
  novas: number;
  /** Alunos reais do ano letivo = rematriculas + novas. */
  confirmados: number;
  preenchido: boolean;
};

export function resumir(grade: GradeColegio): ResumoColegio {
  const r = { alunosHoje: 0, concluintes: 0, rematriculas: 0, desistencias: 0, semResposta: 0, novas: 0 };
  for (const s of SERIES) {
    const l = normalizarLinha(s.id, grade[s.id]);
    r.alunosHoje += l.alunos_hoje;
    if (ehConcluinte(s.id)) r.concluintes += l.alunos_hoje;
    r.rematriculas += l.rematriculas;
    r.desistencias += l.desistencias;
    r.semResposta += semRespostaDaLinha(s.id, l);
    r.novas += l.novas;
  }
  return {
    ...r,
    elegiveis: r.alunosHoje - r.concluintes,
    confirmados: r.rematriculas + r.novas,
    preenchido: r.alunosHoje + r.novas > 0,
  };
}
