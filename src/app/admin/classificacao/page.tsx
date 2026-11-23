import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import MapaClient from "@/components/gav/MapaClient";
import { listarMapa, listarVendedores } from "@/lib/ca/mapa";
import { listSellers } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Classificacao do Conta Azul (categoria/item -> linha de receita, vendedor do
 * Conta Azul -> vendedor do Hub). Morava em /admin/gav/mapa; agora e uma aba de
 * Configuracoes. A porta de admin esta no layout de /admin.
 */
export default async function ClassificacaoPage() {
  const [mapa, vendedores, sellers] = await Promise.all([
    listarMapa().catch(() => ({ categorias: [], itens: [] })),
    listarVendedores().catch(() => []),
    // Inclui inativos: o historico so fecha se der para ligar venda antiga a
    // quem saiu. Quem decide se entra no ranking e o `active`, nao esta tela.
    listSellers().catch(() => []),
  ]);

  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <MapaClient
        categorias={mapa.categorias}
        itens={mapa.itens}
        vendedores={vendedores}
        sellers={sellers.map((s) => ({ id: s.id, name: s.name, bu: s.bu }))}
      />
    </div>
  );
}
