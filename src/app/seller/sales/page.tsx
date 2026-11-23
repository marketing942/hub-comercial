import { getSession } from "@/lib/auth";
import { getSeller } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase";
import { periodNow } from "@/lib/calc";
import { FONTE_PADRAO } from "@/lib/fonte";
import SalesClient from "./sales-client";

export const dynamic = "force-dynamic";

/**
 * "Minhas vendas" — a lista do vendedor, agora SÓ LEITURA.
 *
 * Até o cutover (2026-11-23) esta tela era onde o vendedor digitava a venda, e
 * lia `origem = 'manual'`. Hoje ela lê `FONTE_PADRAO`, que é o Conta Azul: a
 * mesma lista, a mesma aparência, alimentada sozinha.
 *
 * O lançamento à mão não foi apagado do banco — continua lá com
 * `origem = 'manual'`, e é o que o GAV usa para conferir o histórico. O que
 * saiu foi a digitação: ver `src/lib/fonte.ts`.
 */
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
    .eq("origem", FONTE_PADRAO)
    .eq("seller_id", seller.id)
    .gte("sale_date", firstDay)
    .lt("sale_date", lastDay)
    .order("sale_date", { ascending: false })
    // ⚠️ Desempate por `id`, NÃO por `created_at`: a ponte do Conta Azul apaga e
    // reinsere a janela inteira a cada rodada (ver `src/lib/ca/normaliza.ts`),
    // então `created_at` é a hora do último sync e não diz nada sobre a venda.
    .order("id", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Minhas vendas</h1>
        <p className="text-sm text-white/50">
          Suas vendas do mes, direto do Conta Azul. A lista se atualiza sozinha —
          nao e mais preciso lancar nada aqui.
        </p>
      </div>
      <SalesClient initial={data || []} />
    </div>
  );
}
