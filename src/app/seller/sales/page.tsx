import { getSession } from "@/lib/auth";
import { getSeller } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase";
import { periodNow } from "@/lib/calc";
import SalesClient from "./sales-client";

export const dynamic = "force-dynamic";

export default async function MySalesPage() {
  const s = (await getSession())!;
  const seller = (await getSeller(s.sellerId!))!;
  const { year, month } = periodNow();
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const lastDay = `${next.y}-${String(next.m).padStart(2, "0")}-01`;

  const { data } = await supabaseAdmin
    .from("sales")
    .select("*")
    // So o que foi lancado A MAO. As linhas do Conta Azul (origem =
    // 'conta_azul') existem desde a integracao, mas vivem exclusivamente no GAV
    // (/admin/gav) — nenhuma tela que ja funcionava pode mudar de numero nem
    // mostrar dado novo. Ver src/lib/fonte.ts.
    .eq("origem", "manual")
    .eq("seller_id", seller.id)
    .gte("sale_date", firstDay)
    .lt("sale_date", lastDay)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Minhas vendas</h1>
        <p className="text-sm text-white/50">
          Lance suas vendas do mes. Voce pode editar ou remover depois.
        </p>
      </div>
      <SalesClient seller={seller} initial={data || []} />
    </div>
  );
}
