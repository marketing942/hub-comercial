import MapaClient from "@/components/gav/MapaClient";
import { listarMapa, listarVendedores } from "@/lib/ca/mapa";
import { listSellers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  // A porta de admin esta no layout de /admin/gav.
  const [mapa, vendedores, sellers] = await Promise.all([
    listarMapa().catch(() => ({ categorias: [], itens: [] })),
    listarVendedores().catch(() => []),
    // Inclui inativos: o historico so fecha se der para ligar venda antiga a
    // quem saiu. Quem decide se entra no ranking e o `active`, nao esta tela.
    listSellers().catch(() => []),
  ]);

  return (
    <MapaClient
      categorias={mapa.categorias}
      itens={mapa.itens}
      vendedores={vendedores}
      sellers={sellers.map((s) => ({ id: s.id, name: s.name, bu: s.bu }))}
    />
  );
}
