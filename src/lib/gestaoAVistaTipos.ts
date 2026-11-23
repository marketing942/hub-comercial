/**
 * Tipos e rotulos da Gestao a Vista — SEM nenhum import de servidor (mesma regra
 * de `vendasMesTipos.ts`): componente cliente importa daqui, nunca de
 * `gestaoAVista.ts`, que traz o `supabaseAdmin` junto.
 */
import { COLOR } from "./brand";
import type { BU } from "./products";

export type Origem = "vendedores" | "direto" | "diretoria";

export const ORIGEM_ROTULO: Record<Origem, string> = {
  vendedores: "Vendedores",
  direto: "Direto",
  diretoria: "Diretoria / Grupo",
};

/** Cor de cada origem no grafico e nos cards (so identidade da serie, nao resultado). */
export const COR_ORIGEM: Record<Origem, string> = {
  vendedores: COLOR.gold,
  direto: COLOR.info,
  diretoria: COLOR.mute,
};

export type DiaGestao = {
  dia: number;
  data: string;
  vendedores: number;
  direto: number;
  diretoria: number;
  total: number;
  /** Acumulado do mes ate este dia; `null` nos dias que ainda nao chegaram. */
  acumulado: number | null;
};

export type LinhaCategoria = {
  chave: string;
  rotulo: string;
  /** BU da linha; `grupo` = receita que so existe no grupo (mensalidade, repasse...). */
  bu: BU | "grupo";
  valor: number;
  vendedores: number;
  direto: number;
  diretoria: number;
};

export type GestaoMes = {
  year: number;
  mes: number;
  total: number;
  porOrigem: Record<Origem, number>;
  /** Parte da Diretoria/Grupo que conta para vendedor mas chegou sem dono. */
  semDono: number;
  dias: DiaGestao[];
  categorias: LinhaCategoria[];
  sync: { em: string | null; erro: string | null };
};
