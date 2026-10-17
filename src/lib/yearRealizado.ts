// Leitura da aba Ano no banco (SERVIDOR). Os calculos e tipos puros ficam em
// lib/yearMath.ts, que e seguro pra componentes de cliente.
import { supabaseAdmin } from "./supabase";
import type { BU } from "./products";
import { emptyGrid, type YearGrid } from "./yearMath";

export type YearLoad = {
  grid: YearGrid;
  // true quando a tabela year_realizado ainda nao existe no banco.
  tableMissing: boolean;
};

// Le o ano inteiro. Nunca lanca: se a tabela nao existir (SQL ainda nao
// rodado), devolve a grade vazia + tableMissing pra a tela avisar.
export async function loadYear(year: number): Promise<YearLoad> {
  const grid = emptyGrid();
  const { data, error } = await supabaseAdmin
    .from("year_realizado")
    .select("bu, month, receita, qtd, leads_pago, leads_organico")
    .eq("year", year);

  if (error) {
    console.warn("loadYear falhou (tabela year_realizado existe?):", error.message);
    return { grid, tableMissing: true };
  }

  for (const r of (data as any[]) || []) {
    const bu = r.bu as BU;
    const m = Number(r.month);
    if (!grid[bu] || m < 1 || m > 12) continue;
    grid[bu][m] = {
      receita: Number(r.receita || 0),
      qtd: Number(r.qtd || 0),
      leads_pago: Number(r.leads_pago || 0),
      leads_organico: Number(r.leads_organico || 0),
    };
  }
  return { grid, tableMissing: false };
}
