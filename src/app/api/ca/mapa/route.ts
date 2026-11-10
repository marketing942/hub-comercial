import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  COLEGIO_PRODUCT_IDS,
  CPPEM_PRODUCT_IDS,
  UNICIVE_PRODUCT_IDS,
} from "@/lib/products";

const LINHAS = new Set<string>([...CPPEM_PRODUCT_IDS, ...UNICIVE_PRODUCT_IDS, ...COLEGIO_PRODUCT_IDS]);
const BUS = new Set(["cppem", "unicive", "colegio_cppem"]);

/**
 * Classifica uma categoria ou um item.
 *
 * Valida `product_line` contra a lista real: `buFromProductLine()` manda linha
 * desconhecida para o CPPEM **sem erro**, então um id digitado errado viraria
 * faturamento da BU errada em silêncio.
 *
 * A linha de receita pode ficar fora das 23 quando `conta_vendedor` é false —
 * mensalidade e repasse não têm linha no Hub e vivem só em `ca_receita`.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });

  const b = (await req.json()) as {
    ca_tipo?: string;
    ca_id?: string;
    bu?: string | null;
    product_line?: string | null;
    conta_vendedor?: boolean;
    ignorar?: boolean;
  };

  if (b.ca_tipo !== "categoria" && b.ca_tipo !== "item") {
    return NextResponse.json({ error: "ca_tipo invalido." }, { status: 400 });
  }
  if (!b.ca_id) return NextResponse.json({ error: "ca_id obrigatorio." }, { status: 400 });

  const contaVendedor = !!b.conta_vendedor;
  const linha = b.product_line || null;
  if (contaVendedor && linha && !LINHAS.has(linha)) {
    return NextResponse.json(
      { error: `Linha "${linha}" nao existe no Hub. Receita que conta para vendedor precisa de uma das linhas cadastradas.` },
      { status: 400 },
    );
  }
  if (b.bu && !BUS.has(b.bu)) return NextResponse.json({ error: "BU invalida." }, { status: 400 });

  const { error } = await supabaseAdmin.from("ca_mapa_receita").upsert(
    {
      ca_tipo: b.ca_tipo,
      ca_id: b.ca_id,
      bu: b.bu ?? null,
      product_line: linha,
      conta_vendedor: contaVendedor,
      ignorar: !!b.ignorar,
      classificado_em: new Date().toISOString(),
      classificado_por: "admin",
    },
    { onConflict: "ca_tipo,ca_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
