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

/**
 * Descobre categorias e itens ainda não mapeados e os insere como PENDENTES.
 *
 * Nunca adivinha a classificação — só garante que nada apareça no Conta Azul e
 * fique invisível para quem classifica. Pendência é dinheiro invisível.
 */
export async function descobrirPendencias(): Promise<{ categorias: number; itens: number }> {
  const agora = new Date().toISOString();

  // Categorias usadas em vendas que contam.
  const { data: cats } = await supabaseAdmin
    .from("ca_vendas")
    .select("categoria_ca_id")
    .not("categoria_ca_id", "is", null)
    .limit(10000);
  const catIds = [...new Set((cats ?? []).map((c) => c.categoria_ca_id as string))];

  // Itens — necessários para venda SEM categoria e para a série do Colégio.
  const { data: its } = await supabaseAdmin
    .from("ca_venda_itens")
    .select("item_ca_id, nome")
    .not("item_ca_id", "is", null)
    .limit(20000);
  const porItem = new Map<string, string>();
  for (const i of its ?? []) porItem.set(i.item_ca_id as string, (i.nome as string) ?? "");

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
  const { data: vends } = await supabaseAdmin
    .from("ca_vendas")
    .select("vendedor_ca_id, vendedor_nome")
    .not("vendedor_ca_id", "is", null)
    .limit(10000);
  const porVendedor = new Map<string, string>();
  for (const v of vends ?? []) porVendedor.set(v.vendedor_ca_id as string, (v.vendedor_nome as string) ?? "");
  if (porVendedor.size) {
    await supabaseAdmin.from("ca_vendedores").upsert(
      [...porVendedor].map(([id, nome]) => ({ ca_vendedor_id: id, ca_nome: nome, visto_em: agora })),
      { onConflict: "ca_vendedor_id", ignoreDuplicates: true },
    );
  }

  return { categorias: catIds.length, itens: porItem.size };
}
