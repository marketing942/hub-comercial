import { listSellers } from "@/lib/data";
import { lerTudo } from "@/lib/ca/ler";
import { nomeDoCA } from "@/lib/ca/nomes";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import SellersClient from "./sellers-client";

export const dynamic = "force-dynamic";

export default async function SellersPage() {
  const sellers = await listSellers();
  // Cadastros de vendedor do Conta Azul (de onde vem o nome). Sem a tabela, lista vazia.
  const caRows = await lerTudo<{ ca_vendedor_id: string; ca_nome: string | null; destino: string | null; seller_id: string | null }>(
    "ca_vendedores",
    "ca_vendedor_id, ca_nome, destino, seller_id",
    { ordenarPor: "ca_vendedor_id" },
  ).catch(() => []);
  const caVendedores = caRows
    .filter((v) => v.ca_nome)
    .map((v) => ({ id: v.ca_vendedor_id, nome: nomeDoCA(v.ca_nome), destino: v.destino ?? "pendente", sellerId: v.seller_id }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ligados = new Set(caVendedores.filter((v) => v.sellerId).map((v) => v.sellerId as string));
  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Vendedores</h1>
        <p className="text-sm text-white/50">
          O nome vem do Conta Azul: escolha o vendedor de lá e diga em quais BUs ele atua. Aqui ficam também o status, a senha e a BU de cada um.
        </p>
      </div>
      <SellersClient
        initial={sellers.map((s) => ({ ...s, ligadoAoCA: ligados.has(s.id) }))}
        caDisponiveis={caVendedores.filter((v) => !v.sellerId).map((v) => ({ id: v.id, nome: v.nome, destino: v.destino }))}
      />
    </div>
  );
}
