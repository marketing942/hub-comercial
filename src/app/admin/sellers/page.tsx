import { listSellers, buListOf } from "@/lib/data";
import { listarVendedores } from "@/lib/ca/mapa";
import { nomeDoCA } from "@/lib/ca/nomes";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import SellersClient, { type Pessoa } from "./sellers-client";

export const dynamic = "force-dynamic";

/**
 * Uma lista so (26/11/2026): TODOS os cadastros de vendedor do Conta Azul, com o
 * destino de cada um; quem e "Vendedor" ganha BU, status e senha do Hub.
 * Cadastros ligados ao mesmo vendedor do Hub aparecem numa linha so.
 */
export default async function SellersPage() {
  const [sellers, ca] = await Promise.all([listSellers(), listarVendedores()]);
  const porId = new Map(sellers.map((s) => [s.id, s]));

  const grupos = new Map<string, typeof ca>();
  for (const c of ca) {
    const k = c.seller_id && porId.has(c.seller_id) ? c.seller_id : `ca:${c.ca_vendedor_id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }

  const hub = (id: string | null) => {
    const s = id ? porId.get(id) : undefined;
    return s ? { id: s.id, bus: buListOf(s), active: Boolean(s.active), temSenha: Boolean(s.has_password) } : null;
  };

  const pessoas: Pessoa[] = Array.from(grupos.entries()).map(([k, regs]) => {
    const vend = regs.find((r) => r.destino === "vendedor");
    const vinculado = hub(k.startsWith("ca:") ? null : k);
    return {
      chave: k,
      nome: (vinculado && porId.get(k)?.name) || nomeDoCA(regs[0].ca_nome) || regs[0].ca_vendedor_id,
      cadastros: regs.map((r) => nomeDoCA(r.ca_nome) || r.ca_vendedor_id),
      caIds: regs.map((r) => r.ca_vendedor_id),
      destino: vend ? "vendedor" : regs.some((r) => r.destino === "pendente") ? "pendente" : regs[0].destino,
      vendas: regs.reduce((a, r) => a + r.vendas, 0),
      valor: regs.reduce((a, r) => a + r.valor, 0),
      hub: vinculado,
    };
  });

  // Vendedor do Hub sem nenhum cadastro no Conta Azul: aparece para nao sumir.
  for (const s of sellers) {
    if (grupos.has(s.id)) continue;
    pessoas.push({ chave: s.id, nome: s.name, cadastros: [], caIds: [], destino: "vendedor", vendas: 0, valor: 0, hub: hub(s.id) });
  }

  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Vendedores</h1>
        <p className="text-sm text-white/50">
          Todos os vendedores vem do Conta Azul. Escolha o destino de cada um; quem for <b>Vendedor</b> recebe BU, status e senha.
        </p>
      </div>
      <SellersClient pessoas={pessoas} />
    </div>
  );
}
