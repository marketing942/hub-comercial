/**
 * Tipos e rotulos da Gestao a Vista — SEM nenhum import de servidor (mesma regra
 * de `vendasMesTipos.ts`): componente cliente importa daqui, nunca de
 * `gestaoAVista.ts`, que traz o `supabaseAdmin` junto.
 */
import { COLOR } from "./brand";
import type { BU } from "./products";

/** Quem trouxe a receita (decidido pela classificacao de vendedores + a regra "conta p/ vendedor"). */
export type Origem = "vendedores" | "direto" | "diretoria";
export const ORIGENS: Origem[] = ["vendedores", "direto", "diretoria"];

export const ORIGEM_ROTULO: Record<Origem, string> = {
  vendedores: "Vendedores",
  direto: "Direto",
  diretoria: "Pós-venda",
};

/** Cor de cada origem (identidade da serie no grafico, nao resultado). */
export const COR_ORIGEM: Record<Origem, string> = {
  vendedores: COLOR.gold,
  direto: COLOR.info,
  diretoria: COLOR.mute,
};

/** BU da receita. `grupo` = categoria do Conta Azul sem BU definida. */
export type BuKey = BU | "grupo";
export const BUS_GESTAO: BuKey[] = ["cppem", "unicive", "colegio_cppem", "grupo"];

export const BU_GESTAO_ROTULO: Record<BuKey, string> = {
  cppem: "CPPEM",
  unicive: "UNICIVE",
  colegio_cppem: "Colégio CPPEM",
  grupo: "Sem BU definida",
};

/** Cores por BU no grafico: so identidade (ver CLAUDE.md §2). */
export const COR_BU: Record<BuKey, string> = {
  cppem: "#c9ae7a",
  // 26/11/2026: UNICIVE verde no GAV (era o amarelo da marca, confundia com o
  // dourado do CPPEM nas bolinhas). So identidade, nunca resultado.
  unicive: "#3fbf8a",
  colegio_cppem: "#5B8FE0",
  grupo: COLOR.mute,
};

/** Paleta das categorias de receita no grafico (a cor so distingue a serie). */
export const PALETA_CATEGORIAS = [
  "#c9ae7a", "#5B8FE0", "#F5C518", "#5fd08f", "#a78bfa", "#ee7d73",
  "#74aee0", "#f0b44c", "#2dd4bf", "#f472b6", "#af9256", "#94a3b8",
] as const;

export type DiaGestao = {
  dia: number;
  /** Visao anual: nome do mes ("Jan"...); na mensal, vazio. */
  rotulo?: string;
  data: string;
  total: number;
  origem: Record<Origem, number>;
  bu: Record<BuKey, number>;
  /** Por categoria de receita (chave de `GestaoMes.categorias`). */
  categoria: Record<string, number>;
  /** Acumulado do mes ate este dia; `null` nos dias que ainda nao chegaram. */
  acumulado: number | null;
};

export type LinhaCategoria = {
  chave: string;
  rotulo: string;
  bu: BuKey;
  valor: number;
  origem: Record<Origem, number>;
  /** Meta do mes da categoria (Configuracoes > Metas por linha); 0 = sem meta. */
  metaValor: number;
};

export type GestaoMes = {
  year: number;
  /** Mes (1-12) ou `null` na visao anual. */
  mes: number | null;
  anual: boolean;
  /** Faturamento da empresa no mes (todas as linhas do Conta Azul). */
  total: number;
  /** Meta de receita da empresa no periodo: soma de TODAS as metas por linha (ca_metas_linha). */
  metaTotal: number;
  /** Meta por BU (soma das metas por linha de cada BU). */
  metaPorBu: Record<BuKey, number>;
  /** Realizado por BU. */
  porBu: Record<BuKey, number>;
  porOrigem: Record<Origem, number>;
  /**
   * Meta por origem — AUTOMATICA, derivada das metas por linha (ver
   * `distribuirMetaPorOrigem` em gestaoAVista.ts). Soma exatamente `metaTotal`.
   */
  metaPorOrigem: Record<Origem, number>;
  /** Parte da Diretoria/Grupo que conta para vendedor mas chegou sem dono. */
  semDono: number;
  dias: DiaGestao[];
  categorias: LinhaCategoria[];
  /** A tabela `ca_linha_receita` ainda nao existe (rodar supabase/ca-03-linha-receita.sql). */
  semTabela: boolean;
};

export const vazioOrigem = (): Record<Origem, number> => ({ vendedores: 0, direto: 0, diretoria: 0 });
export const vazioBu = (): Record<BuKey, number> => ({ cppem: 0, unicive: 0, colegio_cppem: 0, grupo: 0 });
