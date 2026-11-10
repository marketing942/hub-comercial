/**
 * Reprocessamento local: descobre pendências e renormaliza a janela.
 *
 * ## O que ESTE arquivo não faz mais
 *
 * Ele não busca nada. Quem traz o dado do Conta Azul é o Jarvis, que empurra
 * para `/api/ca/receber` depois de cada rodada do próprio espelho — ver o
 * cabeçalho daquela rota para o porquê de a ponte ser de empurrar e não de
 * puxar.
 *
 * O que sobra aqui é o botão "Reprocessar" do painel, e ele é útil justamente
 * no caso mais comum: alguém classificou categorias e itens na tela de
 * Classificação e quer ver o efeito **agora**, sem esperar o próximo empurrão.
 * Reclassificar não muda o espelho, muda só a leitura dele.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { descobrirPendencias } from "./espelho";
import { normalizarJanela, type ResultadoNormalizacao } from "./normaliza";

export interface ResultadoSync {
  de: string;
  ate: string;
  /** Vendas que o espelho local já tinha na janela — não houve busca. */
  lidas: number;
  pendenciasDescobertas: { categorias: number; itens: number };
  normalizacao: ResultadoNormalizacao;
  ms: number;
}

/** Primeiro dia do mês, `AAAA-MM-DD`. */
function primeiroDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Janela padrão: do primeiro dia de `mesesAtras` meses até hoje.
 *
 * 3 meses, e não só o mês corrente, porque venda antiga ainda muda — baixa,
 * cancelamento e, principalmente, a troca de vendedor feita à mão dias depois.
 */
export function janelaPadrao(mesesAtras = 3): { de: string; ate: string } {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (mesesAtras - 1), 1);
  const ate = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return { de: primeiroDia(inicio), ate };
}

export async function reprocessar(opts?: { de?: string; ate?: string }): Promise<ResultadoSync> {
  const padrao = janelaPadrao();
  const de = opts?.de ?? padrao.de;
  const ate = opts?.ate ?? padrao.ate;
  const t0 = Date.now();

  const { count } = await supabaseAdmin
    .from("ca_vendas")
    .select("*", { count: "exact", head: true })
    .gte("data", de)
    .lte("data", ate);

  const pend = await descobrirPendencias();
  const norm = await normalizarJanela(de, ate);

  const resultado: ResultadoSync = {
    de,
    ate,
    lidas: count ?? 0,
    pendenciasDescobertas: pend,
    normalizacao: norm,
    ms: Date.now() - t0,
  };

  await supabaseAdmin.from("ca_sync").upsert(
    {
      recurso: "reprocessamento",
      iniciado_em: new Date(t0).toISOString(),
      concluido_em: new Date().toISOString(),
      lidos: resultado.lidas,
      gravados: norm.paraSales + norm.paraDireto + norm.paraGrupo,
      erro: null,
      resumo: resultado as unknown as Record<string, unknown>,
    },
    { onConflict: "recurso" },
  );

  return resultado;
}

/** Último empurrão recebido do Jarvis (recurso `vendas`). */
export async function ultimoSync() {
  const { data } = await supabaseAdmin.from("ca_sync").select("*").eq("recurso", "vendas").maybeSingle();
  return data ?? null;
}
