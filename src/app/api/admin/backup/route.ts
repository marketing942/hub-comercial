import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { productLabel, buFromProductLine, ligacaoShort, indicacaoShort } from "@/lib/products";
import { BU_LABEL } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/backup?year=&month=
// Baixa TODOS os dados do mes em um XLSX multi-aba pra backup/analise.
// Apenas admin.
export async function GET(req: Request) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });

  const u = new URL(req.url);
  const year = Number(u.searchParams.get("year"));
  const month = Number(u.searchParams.get("month"));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parametros invalidos. Passe ?year=&month=." }, { status: 400 });
  }

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const nx = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const lastDay = `${nx.y}-${String(nx.m).padStart(2, "0")}-01`;

  // Puxa tudo em paralelo. Todas as consultas usam service_role.
  const [
    sellersRes,
    salesRes,
    directSalesRes,
    leadsRes,
    visitsRes,
    monthlyGoalsRes,
    productGoalsRes,
    buProductGoalsRes,
    buMetaRes,
    commissionRulesRes,
    commissionTiersRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("sellers")
      .select("id, name, bu, bus, active, avatar_color, avatar_url, created_at")
      .order("name"),
    supabaseAdmin
      .from("sales")
      .select("id, seller_id, sale_date, product_line, valor, quantidade, cliente_nome, observacao, ligacao_status, indicacao_status, created_at, updated_at")
      // O backup continua sendo o do lancamento manual, com o mesmo formato de
      // sempre: quem consome o arquivo nao pode receber linhas novas sem aviso.
      // O dado do Conta Azul e reproduzivel a partir do proprio Conta Azul.
      .eq("origem", "manual")
      .gte("sale_date", firstDay)
      .lt("sale_date", lastDay)
      .order("sale_date", { ascending: true }),
    supabaseAdmin
      .from("direct_sales")
      .select("id, sale_date, product_line, valor, quantidade, observacao, channel, created_at")
      .eq("origem", "manual")
      .gte("sale_date", firstDay)
      .lt("sale_date", lastDay)
      .order("sale_date", { ascending: true }),
    supabaseAdmin
      .from("daily_leads")
      .select("id, seller_id, date, qty")
      .gte("date", firstDay)
      .lt("date", lastDay)
      .order("date", { ascending: true }),
    supabaseAdmin
      .from("direct_visits")
      .select("id, date, qty, updated_at")
      .gte("date", firstDay)
      .lt("date", lastDay)
      .order("date", { ascending: true }),
    supabaseAdmin
      .from("monthly_goals")
      .select("seller_id, bu, year, month, valor_meta, quantidade_meta, ticket_medio_meta, taxa_conversao_meta, leads_meta, updated_at")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("product_goals")
      .select("seller_id, year, month, product_line, valor_meta, quantidade_meta")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("bu_product_goals")
      .select("bu, year, month, product_line, valor_meta, quantidade_meta")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("bu_meta")
      .select("bu, year, month, leads_meta, taxa_conversao_meta, updated_at")
      .eq("year", year)
      .eq("month", month),
    supabaseAdmin
      .from("commission_rules")
      .select("bu, min_meta_pct, cumulative, bu_bonus_extra_pct, top1_bonus, top2_bonus, top3_bonus, notes, updated_at"),
    supabaseAdmin
      .from("commission_tiers")
      .select("bu, meta_pct, commission_pct")
      .order("bu")
      .order("meta_pct"),
  ]);

  const sellers = (sellersRes.data as any[]) || [];
  const sellerNameById = new Map<string, string>();
  sellers.forEach((s) => sellerNameById.set(s.id, s.name));
  const buLabel = (id: string) => BU_LABEL[id as keyof typeof BU_LABEL] || id;

  // ====== Monta o XLSX ======
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hub Comercial CPPEM";
  wb.created = new Date();

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // -------- Sumario --------
  const sumario = wb.addWorksheet("Sumario");
  sumario.columns = [
    { header: "Item", key: "item", width: 40 },
    { header: "Valor", key: "value", width: 40 },
  ];
  sumario.addRows([
    { item: "Backup gerado em", value: new Date().toLocaleString("pt-BR") },
    { item: "Periodo", value: `${monthLabel} (${year}-${String(month).padStart(2, "0")})` },
    { item: "Vendedores cadastrados", value: sellers.length },
    { item: "Vendas do mes", value: (salesRes.data || []).length },
    { item: "Vendas do canal direto", value: (directSalesRes.data || []).length },
    { item: "Registros de leads diarios", value: (leadsRes.data || []).length },
    { item: "Registros de visitas do site", value: (visitsRes.data || []).length },
    { item: "Metas mensais (vendedor x BU)", value: (monthlyGoalsRes.data || []).length },
    { item: "Metas por produto (vendedor)", value: (productGoalsRes.data || []).length },
    { item: "Metas por categoria (BU)", value: (buProductGoalsRes.data || []).length },
    { item: "Metas gerais (BU)", value: (buMetaRes.data || []).length },
  ]);
  styleHeader(sumario);

  // -------- Vendedores --------
  const wsSellers = wb.addWorksheet("Vendedores");
  wsSellers.columns = [
    { header: "ID", key: "id", width: 38 },
    { header: "Nome", key: "name", width: 30 },
    { header: "BU Principal", key: "bu", width: 18 },
    { header: "BUs (atua em)", key: "bus", width: 30 },
    { header: "Ativo", key: "active", width: 10 },
    { header: "Cor Avatar", key: "avatar_color", width: 12 },
    { header: "Criado em", key: "created_at", width: 22 },
  ];
  wsSellers.addRows(
    sellers.map((s) => ({
      id: s.id,
      name: s.name,
      bu: buLabel(s.bu),
      bus: Array.isArray(s.bus) ? s.bus.map(buLabel).join(", ") : "",
      active: s.active ? "Sim" : "Nao",
      avatar_color: s.avatar_color,
      created_at: fmtTs(s.created_at),
    }))
  );
  styleHeader(wsSellers);

  // -------- Vendas --------
  const wsSales = wb.addWorksheet("Vendas");
  wsSales.columns = [
    { header: "Data", key: "sale_date", width: 12 },
    { header: "Vendedor", key: "seller_name", width: 28 },
    { header: "BU", key: "bu", width: 18 },
    { header: "Produto", key: "product", width: 30 },
    { header: "Cliente", key: "cliente_nome", width: 30 },
    { header: "Valor (R$)", key: "valor", width: 14, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Qtd", key: "quantidade", width: 8 },
    { header: "Origem (Ligacao)", key: "ligacao", width: 24 },
    { header: "Indicacao", key: "indicacao", width: 20 },
    { header: "Observacao", key: "observacao", width: 40 },
    { header: "ID Venda", key: "id", width: 38 },
    { header: "ID Vendedor", key: "seller_id", width: 38 },
    { header: "Criada em", key: "created_at", width: 22 },
    { header: "Atualizada em", key: "updated_at", width: 22 },
  ];
  wsSales.addRows(
    ((salesRes.data as any[]) || []).map((r) => ({
      sale_date: r.sale_date,
      seller_name: sellerNameById.get(r.seller_id) || "(vendedor removido)",
      bu: buLabel(buFromProductLine(r.product_line)),
      product: productLabel(r.product_line),
      cliente_nome: r.cliente_nome || "",
      valor: Number(r.valor || 0),
      quantidade: Number(r.quantidade || 0),
      ligacao: ligacaoShort(r.ligacao_status || "sem_ligacao"),
      indicacao: indicacaoShort(r.indicacao_status || "sem_indicacao"),
      observacao: r.observacao || "",
      id: r.id,
      seller_id: r.seller_id,
      created_at: fmtTs(r.created_at),
      updated_at: fmtTs(r.updated_at),
    }))
  );
  styleHeader(wsSales);

  // -------- Vendas Direto / IA --------
  const wsDirect = wb.addWorksheet("Vendas Direto e IA");
  wsDirect.columns = [
    { header: "Data", key: "sale_date", width: 12 },
    { header: "Canal", key: "channel", width: 12 },
    { header: "BU", key: "bu", width: 18 },
    { header: "Produto", key: "product", width: 30 },
    { header: "Valor (R$)", key: "valor", width: 14, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Qtd", key: "quantidade", width: 8 },
    { header: "Observacao", key: "observacao", width: 40 },
    { header: "ID", key: "id", width: 38 },
    { header: "Criada em", key: "created_at", width: 22 },
  ];
  wsDirect.addRows(
    ((directSalesRes.data as any[]) || []).map((r) => ({
      sale_date: r.sale_date,
      channel: r.channel === "ia" ? "IA" : "Direto",
      bu: buLabel(buFromProductLine(r.product_line)),
      product: productLabel(r.product_line),
      valor: Number(r.valor || 0),
      quantidade: Number(r.quantidade || 0),
      observacao: r.observacao || "",
      id: r.id,
      created_at: fmtTs(r.created_at),
    }))
  );
  styleHeader(wsDirect);

  // -------- Leads Diarios --------
  const wsLeads = wb.addWorksheet("Leads Diarios");
  wsLeads.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Vendedor", key: "seller_name", width: 28 },
    { header: "Qtd", key: "qty", width: 8 },
    { header: "ID Vendedor", key: "seller_id", width: 38 },
    { header: "ID Registro", key: "id", width: 38 },
  ];
  wsLeads.addRows(
    ((leadsRes.data as any[]) || []).map((r) => ({
      date: r.date,
      seller_name: sellerNameById.get(r.seller_id) || "(vendedor removido)",
      qty: Number(r.qty || 0),
      seller_id: r.seller_id,
      id: r.id,
    }))
  );
  styleHeader(wsLeads);

  // -------- Visitas Site --------
  const wsVisits = wb.addWorksheet("Visitas Site");
  wsVisits.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Qtd", key: "qty", width: 10 },
    { header: "Atualizada em", key: "updated_at", width: 22 },
    { header: "ID", key: "id", width: 38 },
  ];
  wsVisits.addRows(
    ((visitsRes.data as any[]) || []).map((r) => ({
      date: r.date,
      qty: Number(r.qty || 0),
      updated_at: fmtTs(r.updated_at),
      id: r.id,
    }))
  );
  styleHeader(wsVisits);

  // -------- Metas Mensais Vendedor --------
  const wsMonthly = wb.addWorksheet("Metas Mensais Vendedor");
  wsMonthly.columns = [
    { header: "Vendedor", key: "seller_name", width: 28 },
    { header: "BU", key: "bu", width: 18 },
    { header: "Ano", key: "year", width: 8 },
    { header: "Mes", key: "month", width: 8 },
    { header: "Meta Valor (R$)", key: "valor_meta", width: 16, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Meta Qtd", key: "quantidade_meta", width: 12 },
    { header: "Meta Ticket (R$)", key: "ticket_medio_meta", width: 16, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Meta Conversao (%)", key: "taxa_conversao_meta", width: 18 },
    { header: "Meta Leads", key: "leads_meta", width: 12 },
    { header: "ID Vendedor", key: "seller_id", width: 38 },
    { header: "Atualizada em", key: "updated_at", width: 22 },
  ];
  wsMonthly.addRows(
    ((monthlyGoalsRes.data as any[]) || []).map((r) => ({
      seller_name: sellerNameById.get(r.seller_id) || "(vendedor removido)",
      bu: buLabel(r.bu),
      year: r.year,
      month: r.month,
      valor_meta: Number(r.valor_meta || 0),
      quantidade_meta: Number(r.quantidade_meta || 0),
      ticket_medio_meta: Number(r.ticket_medio_meta || 0),
      taxa_conversao_meta: Number(r.taxa_conversao_meta || 0),
      leads_meta: Number(r.leads_meta || 0),
      seller_id: r.seller_id,
      updated_at: fmtTs(r.updated_at),
    }))
  );
  styleHeader(wsMonthly);

  // -------- Metas Produto Vendedor --------
  const wsProd = wb.addWorksheet("Metas Produto Vendedor");
  wsProd.columns = [
    { header: "Vendedor", key: "seller_name", width: 28 },
    { header: "Produto", key: "product", width: 30 },
    { header: "Ano", key: "year", width: 8 },
    { header: "Mes", key: "month", width: 8 },
    { header: "Meta Valor (R$)", key: "valor_meta", width: 16, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Meta Qtd", key: "quantidade_meta", width: 12 },
    { header: "ID Vendedor", key: "seller_id", width: 38 },
  ];
  wsProd.addRows(
    ((productGoalsRes.data as any[]) || []).map((r) => ({
      seller_name: sellerNameById.get(r.seller_id) || "(vendedor removido)",
      product: productLabel(r.product_line),
      year: r.year,
      month: r.month,
      valor_meta: Number(r.valor_meta || 0),
      quantidade_meta: Number(r.quantidade_meta || 0),
      seller_id: r.seller_id,
    }))
  );
  styleHeader(wsProd);

  // -------- Metas Categoria BU --------
  const wsBUProd = wb.addWorksheet("Metas Categoria BU");
  wsBUProd.columns = [
    { header: "BU", key: "bu", width: 18 },
    { header: "Produto", key: "product", width: 30 },
    { header: "Ano", key: "year", width: 8 },
    { header: "Mes", key: "month", width: 8 },
    { header: "Meta Valor (R$)", key: "valor_meta", width: 16, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Meta Qtd", key: "quantidade_meta", width: 12 },
  ];
  wsBUProd.addRows(
    ((buProductGoalsRes.data as any[]) || []).map((r) => ({
      bu: buLabel(r.bu),
      product: productLabel(r.product_line),
      year: r.year,
      month: r.month,
      valor_meta: Number(r.valor_meta || 0),
      quantidade_meta: Number(r.quantidade_meta || 0),
    }))
  );
  styleHeader(wsBUProd);

  // -------- Meta Geral BU --------
  const wsBUMeta = wb.addWorksheet("Meta Geral BU");
  wsBUMeta.columns = [
    { header: "BU", key: "bu", width: 18 },
    { header: "Ano", key: "year", width: 8 },
    { header: "Mes", key: "month", width: 8 },
    { header: "Meta Leads", key: "leads_meta", width: 12 },
    { header: "Meta Conversao (%)", key: "taxa_conversao_meta", width: 18 },
    { header: "Atualizada em", key: "updated_at", width: 22 },
  ];
  wsBUMeta.addRows(
    ((buMetaRes.data as any[]) || []).map((r) => ({
      bu: buLabel(r.bu),
      year: r.year,
      month: r.month,
      leads_meta: Number(r.leads_meta || 0),
      taxa_conversao_meta: Number(r.taxa_conversao_meta || 0),
      updated_at: fmtTs(r.updated_at),
    }))
  );
  styleHeader(wsBUMeta);

  // -------- Comissao Regras (snapshot atual) --------
  const wsCommRules = wb.addWorksheet("Comissao Regras");
  wsCommRules.columns = [
    { header: "BU", key: "bu", width: 18 },
    { header: "Min % Meta", key: "min_meta_pct", width: 12 },
    { header: "Acumulativa", key: "cumulative", width: 12 },
    { header: "Extra Coletiva (%)", key: "extra", width: 18 },
    { header: "Top 1 (R$)", key: "top1", width: 12, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Top 2 (R$)", key: "top2", width: 12, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Top 3 (R$)", key: "top3", width: 12, style: { numFmt: '"R$"#,##0.00' } },
    { header: "Observacoes", key: "notes", width: 40 },
    { header: "Atualizada em", key: "updated_at", width: 22 },
  ];
  wsCommRules.addRows(
    ((commissionRulesRes.data as any[]) || []).map((r) => ({
      bu: buLabel(r.bu),
      min_meta_pct: Number(r.min_meta_pct || 0),
      cumulative: r.cumulative ? "Sim" : "Nao",
      extra: Number(r.bu_bonus_extra_pct || 0),
      top1: Number(r.top1_bonus || 0),
      top2: Number(r.top2_bonus || 0),
      top3: Number(r.top3_bonus || 0),
      notes: r.notes || "",
      updated_at: fmtTs(r.updated_at),
    }))
  );
  styleHeader(wsCommRules);

  // -------- Comissao Tiers --------
  const wsCommTiers = wb.addWorksheet("Comissao Tiers");
  wsCommTiers.columns = [
    { header: "BU", key: "bu", width: 18 },
    { header: "% Meta", key: "meta_pct", width: 12 },
    { header: "% Comissao", key: "commission_pct", width: 14 },
  ];
  wsCommTiers.addRows(
    ((commissionTiersRes.data as any[]) || []).map((r) => ({
      bu: buLabel(r.bu),
      meta_pct: Number(r.meta_pct || 0),
      commission_pct: Number(r.commission_pct || 0),
    }))
  );
  styleHeader(wsCommTiers);

  const buf = await wb.xlsx.writeBuffer();
  const filename = `hub-comercial-backup-${year}-${String(month).padStart(2, "0")}.xlsx`;
  return new Response(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  row.alignment = { vertical: "middle" };
  row.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function fmtTs(ts: any): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("pt-BR");
  } catch {
    return String(ts);
  }
}
