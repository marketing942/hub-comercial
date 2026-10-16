export type BU = "cppem" | "unicive" | "colegio_cppem";
export const ALL_BUS: BU[] = ["cppem", "unicive", "colegio_cppem"];

export const PRODUCT_LINES_CPPEM = [
  { id: "mentorias", label: "Mentorias" },
  { id: "turmas_presenciais", label: "Turmas Presenciais" },
  { id: "cursos_online", label: "Cursos online" },
  { id: "presencial_em_casa", label: "Presencial em casa" },
  { id: "materiais_digitais", label: "Materiais Digitais" },
  { id: "fisicos", label: "Produtos Fisicos" },
  { id: "eventos", label: "Eventos" },
  { id: "supletivo", label: "Supletivo" },
] as const;

export const PRODUCT_LINES_UNICIVE = [
  { id: "matriculas", label: "Matriculas" },
  { id: "bolsas_unicive", label: "Bolsas" },
] as const;

// Colegio: matriculas quebradas por turma (1o ao 9o do fundamental + 1o ao 3o EM) + fardamentos
export const PRODUCT_LINES_COLEGIO = [
  { id: "matricula_fund_1", label: "1o Ano Fundamental" },
  { id: "matricula_fund_2", label: "2o Ano Fundamental" },
  { id: "matricula_fund_3", label: "3o Ano Fundamental" },
  { id: "matricula_fund_4", label: "4o Ano Fundamental" },
  { id: "matricula_fund_5", label: "5o Ano Fundamental" },
  { id: "matricula_fund_6", label: "6o Ano Fundamental" },
  { id: "matricula_fund_7", label: "7o Ano Fundamental" },
  { id: "matricula_fund_8", label: "8o Ano Fundamental" },
  { id: "matricula_fund_9", label: "9o Ano Fundamental" },
  { id: "matricula_em_1", label: "1o Ano Ensino Medio" },
  { id: "matricula_em_2", label: "2o Ano Ensino Medio" },
  { id: "matricula_em_3", label: "3o Ano Ensino Medio" },
  { id: "fardamentos", label: "Fardamentos" },
] as const;

// Matriculas do colegio (sem fardamentos), pra metricas de "alunos por turma"
export const COLEGIO_MATRICULAS_IDS = [
  "matricula_fund_1","matricula_fund_2","matricula_fund_3","matricula_fund_4",
  "matricula_fund_5","matricula_fund_6","matricula_fund_7","matricula_fund_8",
  "matricula_fund_9","matricula_em_1","matricula_em_2","matricula_em_3",
] as const;

export const CPPEM_PRODUCT_IDS = [
  "mentorias","turmas_presenciais","cursos_online","presencial_em_casa","materiais_digitais","fisicos","eventos","supletivo",
] as const;

// Ids antigos que foram consolidados nas novas categorias. Mantido pra
// (1) fallback de label ate a migracao rodar e (2) permitir mapeamento
// reverso em relatorios historicos.
const LEGACY_LABELS: Record<string, string> = {
  cursos_digitais: "Cursos online",
  turma_pmal: "Turmas Presenciais",
  turma_pmpe: "Turmas Presenciais",
  turma_carreiras: "Turmas Presenciais",
};
export const UNICIVE_PRODUCT_IDS = ["matriculas", "bolsas_unicive"] as const;
export const COLEGIO_PRODUCT_IDS = PRODUCT_LINES_COLEGIO.map((p) => p.id) as readonly string[];

export type ProductLineId =
  | (typeof PRODUCT_LINES_CPPEM)[number]["id"]
  | (typeof PRODUCT_LINES_UNICIVE)[number]["id"]
  | (typeof PRODUCT_LINES_COLEGIO)[number]["id"];

export function productLinesFor(bu: BU) {
  if (bu === "cppem") return PRODUCT_LINES_CPPEM;
  if (bu === "unicive") return PRODUCT_LINES_UNICIVE;
  return PRODUCT_LINES_COLEGIO;
}

export function productIdsFor(bu: BU): readonly string[] {
  if (bu === "cppem") return CPPEM_PRODUCT_IDS;
  if (bu === "unicive") return UNICIVE_PRODUCT_IDS;
  return COLEGIO_PRODUCT_IDS;
}

export function buFromProductLine(pl: string): BU {
  if ((UNICIVE_PRODUCT_IDS as readonly string[]).includes(pl)) return "unicive";
  if ((COLEGIO_PRODUCT_IDS as readonly string[]).includes(pl)) return "colegio_cppem";
  return "cppem";
}

export function productLabel(id: string): string {
  const all = [...PRODUCT_LINES_CPPEM, ...PRODUCT_LINES_UNICIVE, ...PRODUCT_LINES_COLEGIO];
  const found = all.find((p) => p.id === id);
  if (found) return found.label;
  return LEGACY_LABELS[id] || id;
}

// Para o COLEGIO CPPEM, a metrica primaria e quantidade de matriculas.
// UNICIVE tambem lida com matriculas, mas o foco de meta e ranking e
// FATURAMENTO dessas matriculas — a quantidade fica como secundaria.
// CPPEM sempre foi faturamento.
export function isQtdPrimary(bu: BU): boolean {
  return bu === "colegio_cppem";
}

// ===== Status da ligacao Onvox =====
export const LIGACAO_STATUSES = [
  { id: "consegui_direto", label: "Consegui diretamente pela ligacao", short: "Direto pela ligacao", color: "#5fd08f" },
  { id: "consegui_indireto", label: "Consegui indiretamente com ligacao", short: "Indireto com ligacao", color: "#06b6d4" },
  { id: "sem_ligacao", label: "Nao houve nenhuma ligacao", short: "Sem ligacao", color: "#ada99b" },
] as const;

export type LigacaoStatusId = (typeof LIGACAO_STATUSES)[number]["id"];

export function ligacaoLabel(id: string) { return LIGACAO_STATUSES.find((s) => s.id === id)?.label || id; }
export function ligacaoShort(id: string) { return LIGACAO_STATUSES.find((s) => s.id === id)?.short || id; }
export function ligacaoColor(id: string) { return LIGACAO_STATUSES.find((s) => s.id === id)?.color || "#ada99b"; }

// ===== Indicacao (foi por indicacao ou nao) =====
export const INDICACAO_STATUSES = [
  { id: "feita_por_indicacao", label: "Feita por indicacao", short: "Por indicacao", color: "#5fd08f" },
  { id: "sem_indicacao", label: "Nao foi por indicacao", short: "Sem indicacao", color: "#ada99b" },
] as const;

export type IndicacaoStatusId = (typeof INDICACAO_STATUSES)[number]["id"];

export function indicacaoLabel(id: string) { return INDICACAO_STATUSES.find((s) => s.id === id)?.label || id; }
export function indicacaoShort(id: string) { return INDICACAO_STATUSES.find((s) => s.id === id)?.short || id; }
export function indicacaoColor(id: string) { return INDICACAO_STATUSES.find((s) => s.id === id)?.color || "#ada99b"; }
