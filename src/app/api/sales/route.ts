import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { todayISORecife } from "@/lib/calc";
import { FONTE_PADRAO } from "@/lib/fonte";

/**
 * POST /api/sales — FECHADO no cutover de 2026-11-23.
 *
 * O faturamento passou a vir inteiro do Conta Azul (`src/lib/fonte.ts`). Aceitar
 * um lançamento à mão agora criaria uma venda que nenhuma tela soma — as telas
 * leem `origem = 'conta_azul'` — e o vendedor ficaria esperando um número que
 * nunca ia subir.
 *
 * A porta se fecha AQUI, no servidor, e não só escondendo o botão: a tela do
 * vendedor é código que roda no navegador dele.
 *
 * O corpo antigo continua abaixo, intocado e inalcançável, de propósito — é o
 * caminho de volta se o cutover precisar ser revertido. Reverter é soltar este
 * bloco e trocar `FONTE_PADRAO` de volta para `"manual"`.
 */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  return NextResponse.json(
    {
      error:
        "O lancamento manual de vendas foi desativado. O faturamento agora vem do Conta Azul automaticamente.",
    },
    { status: 410 },
  );
}

async function POST_DESATIVADO(req: Request) {
  const s = await getSession();
  if (s?.role !== "seller" || !s.sellerId) {
    return NextResponse.json({ error: "Apenas vendedores logados." }, { status: 401 });
  }
  const b = await req.json();
  const { sale_date, product_line, valor, quantidade, cliente_nome, observacao, ligacao_status, indicacao_status } = b || {};
  if (!sale_date || !product_line) {
    return NextResponse.json({ error: "Faltam sale_date / product_line." }, { status: 400 });
  }
  // Guarda: nao aceita venda com data no futuro (fuso de Recife). Protege
  // contra o bug do default UTC que fazia venda da noite ser contabilizada
  // no dia seguinte.
  if (typeof sale_date === "string" && sale_date > todayISORecife()) {
    return NextResponse.json(
      { error: "Data da venda nao pode ser no futuro." },
      { status: 400 }
    );
  }
  const validLigacao = ["consegui_direto", "consegui_indireto", "sem_ligacao"];
  const ligacao = validLigacao.includes(ligacao_status) ? ligacao_status : "sem_ligacao";
  const validIndicacao = ["feita_por_indicacao", "sem_indicacao"];
  const indicacao = validIndicacao.includes(indicacao_status) ? indicacao_status : "sem_indicacao";
  const cliente = typeof cliente_nome === "string" ? cliente_nome.trim().slice(0, 200) : "";
  const { data, error } = await supabaseAdmin
    .from("sales")
    .insert({
      seller_id: s.sellerId,
      sale_date,
      product_line,
      valor: Number(valor || 0),
      quantidade: Number(quantidade || 1),
      cliente_nome: cliente || null,
      observacao: observacao || null,
      ligacao_status: ligacao,
      indicacao_status: indicacao,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// GET /api/sales?seller_id=&year=&month=
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const u = new URL(req.url);
  const year = Number(u.searchParams.get("year"));
  const month = Number(u.searchParams.get("month"));
  const sellerParam = u.searchParams.get("seller_id");
  // Admin pode consultar qualquer vendedor; vendedor SO ve os proprios dados.
  const sellerId = session.role === "admin" ? sellerParam : session.sellerId;

  if (!year || !month || !sellerId) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const lastDay = `${next.y}-${String(next.m).padStart(2, "0")}-01`;
  const { data, error } = await supabaseAdmin
    .from("sales")
    .select("*")
    // Acompanha a fonte das telas: depois do cutover isto e 'conta_azul'.
    // Fixar "manual" aqui devolveria lista vazia. Ver src/lib/fonte.ts.
    .eq("origem", FONTE_PADRAO)
    .eq("seller_id", sellerId)
    .gte("sale_date", firstDay)
    .lt("sale_date", lastDay)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
