import { listSellers } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase";
import { FONTE_PADRAO } from "@/lib/fonte";
import { periodNow } from "@/lib/calc";
import { productIdsFor, type BU } from "@/lib/products";
import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import VendasClient from "./vendas-client";
import BackupButton from "./BackupButton";

export const dynamic = "force-dynamic";

type SearchParams = {
  year?: string;
  month?: string;
  seller_id?: string;
  bu?: string;
};

const ALL = "todos";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = periodNow();
  const year = Number(searchParams.year) || now.year;
  const month = Number(searchParams.month) || now.month;
  const sellerId = searchParams.seller_id && searchParams.seller_id !== ALL ? searchParams.seller_id : null;
  const buFilter =
    searchParams.bu === "cppem" || searchParams.bu === "unicive" || searchParams.bu === "colegio_cppem"
      ? (searchParams.bu as BU)
      : null;

  const sellers = await listSellers();

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const nx = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const lastDay = `${nx.y}-${String(nx.m).padStart(2, "0")}-01`;

  let q = supabaseAdmin
    .from("sales")
    .select("id, seller_id, sale_date, product_line, valor, quantidade, cliente_nome, observacao, ligacao_status, indicacao_status, created_at")
    // Segue a fonte das telas (hoje: Conta Azul). Antes do cutover isto era
    // "manual" fixo, sob a regra de que nenhuma tela existente podia mudar de
    // numero. A regra se inverteu: ficar em "manual" agora congelaria esta tela
    // no historico e ela mostraria menos do que o painel. Ver src/lib/fonte.ts.
    .eq("origem", FONTE_PADRAO)
    .gte("sale_date", firstDay)
    .lt("sale_date", lastDay)
    .order("sale_date", { ascending: false })
    // Desempate por `id`: `created_at` das linhas do Conta Azul e a hora do
    // ultimo sync (a ponte apaga e reinsere a janela), nao a da venda.
    .order("id", { ascending: false });

  if (sellerId) q = q.eq("seller_id", sellerId);
  if (buFilter) {
    const ids = productIdsFor(buFilter) as unknown as string[];
    q = q.in("product_line", ids);
  }

  const { data: sales } = await q;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Todas as vendas</h1>
          <p className="text-sm text-white/50">
            Todas as vendas do sistema no periodo selecionado. Filtre por vendedor, BU ou mes para
            conferencia detalhada.
          </p>
        </div>
        <BackupButton year={year} month={month} monthLabel={monthName} />
      </div>
      <VendasClient
        sellers={sellers}
        sales={(sales as any[]) || []}
        year={year}
        month={month}
        sellerId={sellerId}
        bu={buFilter}
      />
    </div>
  );
}
