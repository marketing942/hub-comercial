import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import MapaClient from "@/components/gav/MapaClient";
import { listarMapa } from "@/lib/ca/mapa";

export const dynamic = "force-dynamic";

/**
 * Classificacao do Conta Azul (categoria/item -> linha de receita, vendedor do
 * Conta Azul -> vendedor do Hub). Morava em /admin/gav/mapa; agora e uma aba de
 * Configuracoes. A porta de admin esta no layout de /admin.
 */
export default async function ClassificacaoPage() {
  const mapa = await listarMapa().catch(() => ({ categorias: [], itens: [] }));

  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <MapaClient
        categorias={mapa.categorias}
        itens={mapa.itens}
      />
    </div>
  );
}
