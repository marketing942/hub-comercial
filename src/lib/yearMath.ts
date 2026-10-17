// Tipos e calculos PUROS da aba Ano (sem acesso a banco), seguros pra importar
// em componente de cliente. A leitura do banco fica em lib/yearRealizado.ts.
import type { BU } from "./products";

export const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

export const YEAR_MIN = 2024;
export const YEAR_MAX = 2100;

// Uma linha por mes: so totais (sem categorias e sem metas).
export type YearMonthRow = {
  receita: number;
  qtd: number;
  leads_pago: number;
  leads_organico: number;
};

export const EMPTY_MONTH: YearMonthRow = {
  receita: 0,
  qtd: 0,
  leads_pago: 0,
  leads_organico: 0,
};

// bu -> mes (1..12) -> valores
export type YearGrid = Record<BU, Record<number, YearMonthRow>>;

export function emptyGrid(): YearGrid {
  const mk = () => {
    const o: Record<number, YearMonthRow> = {};
    for (let m = 1; m <= 12; m++) o[m] = { ...EMPTY_MONTH };
    return o;
  };
  return { cppem: mk(), unicive: mk(), colegio_cppem: mk() };
}

export type YearTotals = {
  receita: number;
  qtd: number;
  leadsPago: number;
  leadsOrganico: number;
  leads: number;
  ticket: number;     // receita / qtd
  conversao: number;  // qtd / leads * 100
};

export function monthLeads(r: YearMonthRow): number {
  return r.leads_pago + r.leads_organico;
}
export function monthTicket(r: YearMonthRow): number {
  return r.qtd > 0 ? r.receita / r.qtd : 0;
}
export function monthConversao(r: YearMonthRow): number {
  const l = monthLeads(r);
  return l > 0 ? (r.qtd / l) * 100 : 0;
}

export function totalsOf(months: Record<number, YearMonthRow>): YearTotals {
  let receita = 0, qtd = 0, leadsPago = 0, leadsOrganico = 0;
  for (let m = 1; m <= 12; m++) {
    const r = months[m] || EMPTY_MONTH;
    receita += r.receita;
    qtd += r.qtd;
    leadsPago += r.leads_pago;
    leadsOrganico += r.leads_organico;
  }
  const leads = leadsPago + leadsOrganico;
  return {
    receita,
    qtd,
    leadsPago,
    leadsOrganico,
    leads,
    ticket: qtd > 0 ? receita / qtd : 0,
    conversao: leads > 0 ? (qtd / leads) * 100 : 0,
  };
}
