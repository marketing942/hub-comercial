/**
 * Descoberta de pendências de classificação sobre o espelho local.
 *
 * A leitura do Conta Azul saiu daqui em 10/11/2026 e virou `./ponte.ts`: o Hub
 * não consegue um app próprio na API v2 (um app aceita UMA url de redirect, e
 * app "de produção" nem fala v2), então quem conversa com o Conta Azul é o
 * Jarvis e o Hub lê o espelho dele.
 *
 * O que sobrou aqui não depende de onde o dado veio: olha `ca_vendas` e
 * `ca_venda_itens` locais e garante que toda categoria, item e vendedor novo
 * apareça na fila de classificação. Nunca adivinha a classificação — só impede
 * que algo exista no Conta Azul e fique invisível para quem classifica.
 * Pendência é dinheiro invisível.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { lerTudo } from "./ler";

/**
 * Descobre categorias e itens ainda não mapeados e os insere como PENDENTES.
 *
 * Nunca adivinha a classificação — só garante que nada apareça no Conta Azul e
 * fique invisível para quem classifica. Pendência é dinheiro invisível.
 */
export async function descobrirPendencias(): Promise<{ categorias: number; itens: number }> {
  const agora = new Date().toISOString();

  // Categorias usadas em vendas que contam.
  // PAGINADO: `.limit(N)` não levanta o teto de 1.000 do PostgREST (ver ./ler.ts).
  const cats = await lerTudo<{ categoria_ca_id: string }>("ca_vendas", "ca_id, categoria_ca_id", {
    filtrar: (q) => (q as never as { not: Function }).not("categoria_ca_id", "is", null),
  });
  const catIds = [...new Set(cats.map((c) => c.categoria_ca_id))];

  // Itens — necessários para venda SEM categoria e para a série do Colégio.
  const its = await lerTudo<{ item_ca_id: string; nome: string | null }>(
    "ca_venda_itens",
    "ca_id, item_ca_id, nome",
    { filtrar: (q) => (q as never as { not: Function }).not("item_ca_id", "is", null) },
  );
  const porItem = new Map<string, string>();
  for (const i of its) porItem.set(i.item_ca_id, i.nome ?? "");

  const linhas = [
    ...catIds.map((id) => ({ ca_tipo: "categoria", ca_id: id, visto_em: agora })),
    ...[...porItem].map(([id, nome]) => ({ ca_tipo: "item", ca_id: id, ca_nome: nome, visto_em: agora })),
  ];

  // `ignoreDuplicates` para NÃO sobrescrever o que já foi classificado à mão.
  for (let i = 0; i < linhas.length; i += 500) {
    await supabaseAdmin
      .from("ca_mapa_receita")
      .upsert(linhas.slice(i, i + 500), { onConflict: "ca_tipo,ca_id", ignoreDuplicates: true });
  }

  // Vendedores vistos no CA.
  const vends = await lerTudo<{ vendedor_ca_id: string; vendedor_nome: string | null }>(
    "ca_vendas",
    "ca_id, vendedor_ca_id, vendedor_nome",
    { filtrar: (q) => (q as never as { not: Function }).not("vendedor_ca_id", "is", null) },
  );
  const porVendedor = new Map<string, string>();
  for (const v of vends) porVendedor.set(v.vendedor_ca_id, v.vendedor_nome ?? "");
  if (porVendedor.size) {
    await supabaseAdmin.from("ca_vendedores").upsert(
      [...porVendedor].map(([id, nome]) => ({ ca_vendedor_id: id, ca_nome: nome, visto_em: agora })),
      { onConflict: "ca_vendedor_id", ignoreDuplicates: true },
    );
  }

  return { categorias: catIds.length, itens: porItem.size };
}
