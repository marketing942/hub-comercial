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
  diretoria: "Diretoria / Grupo",
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
  unicive: "#F5C518",
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
};

export type GestaoMes = {
  year: number;
  mes: number;
  /** Faturamento da empresa no mes (todas as linhas do Conta Azul). */
  total: number;
  porOrigem: Record<Origem, number>;
  /** Parte da Diretoria/Grupo que conta para vendedor mas chegou sem dono. */
  semDono: number;
  dias: DiaGestao[];
  categorias: LinhaCategoria[];
  /** A tabela `ca_linha_receita` ainda nao existe (rodar supabase/ca-03-linha-receita.sql). */
  semTabela: boolean;
  sync: { em: string | null; erro: string | null };
};

export const vazioOrigem = (): Record<Origem, number> => ({ vendedores: 0, direto: 0, diretoria: 0 });
export const vazioBu = (): Record<BuKey, number> => ({ cppem: 0, unicive: 0, colegio_cppem: 0, grupo: 0 });
