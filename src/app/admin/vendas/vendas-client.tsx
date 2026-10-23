"use client";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, UserPlus, User, Filter, Download } from "lucide-react";
import {
  productLabel,
  buFromProductLine,
  ligacaoShort,
  ligacaoColor,
  indicacaoShort,
  indicacaoColor,
  type BU,
} from "@/lib/products";
import { BU_LABEL, BU_COLOR } from "@/lib/brand";
import { BRL, fmtInt } from "@/lib/calc";

type Seller = {
  id: string;
  name: string;
  bu: BU;
  bus?: BU[];
  active?: boolean;
};

type Sale = {
  id: string;
  seller_id: string;
  sale_date: string;
  product_line: string;
  valor: number;
  quantidade: number;
  cliente_nome?: string | null;
  observacao?: string | null;
  ligacao_status?: string | null;
  indicacao_status?: string | null;
};

const MONTHS = [
  "Janeiro","Fevereiro","Marco","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const ALL = "todos";

export default function VendasClient({
  sellers,
  sales,
  year,
  month,
  sellerId,
  bu,
}: {
  sellers: Seller[];
  sales: Sale[];
  year: number;
  month: number;
  sellerId: string | null;
  bu: BU | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const sellerById = useMemo(() => {
    const m = new Map<string, Seller>();
    sellers.forEach((s) => m.set(s.id, s));
    return m;
  }, [sellers]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params?.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.push(`/admin/vendas?${next.toString()}`);
  }

  function setYearMonth(y: number, m: number) {
    const next = new URLSearchParams(params?.toString());
    next.set("year", String(y));
    next.set("month", String(m));
    router.push(`/admin/vendas?${next.toString()}`);
  }

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur - 1, cur, cur + 1];
  }, []);

  // filtro cliente-side pra vendedor (o filtro server ja aplicou),
  // mas se o vendedor selecionado nao atua na BU escolhida, o server
  // ainda devolve zero — apenas espelhamos aqui.
  const totalValor = sales.reduce((a, s) => a + Number(s.valor || 0), 0);
  const totalQtd = sales.reduce((a, s) => a + Number(s.quantidade || 0), 0);

  function exportCsv() {
    const header = [
      "data","vendedor","bu","produto","cliente","valor","quantidade","ligacao","indicacao","observacao",
    ];
    const rows = sales.map((s) => {
      const vendedor = sellerById.get(s.seller_id)?.name || s.seller_id;
      const b = buFromProductLine(s.product_line);
      return [
        s.sale_date,
        vendedor,
        BU_LABEL[b],
        productLabel(s.product_line),
        s.cliente_nome || "",
        Number(s.valor || 0).toFixed(2).replace(".", ","),
        String(s.quantidade || 0),
        ligacaoShort(s.ligacao_status || "sem_ligacao"),
        indicacaoShort(s.indicacao_status || "sem_indicacao"),
        (s.observacao || "").replace(/\r?\n/g, " "),
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas_${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3 text-sm text-white/70">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="label">Mes</label>
            <select
              className="input h-9"
              value={month}
              onChange={(e) => setYearMonth(year, Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ano</label>
            <select
              className="input h-9"
              value={year}
              onChange={(e) => setYearMonth(Number(e.target.value), month)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">BU</label>
            <select
              className="input h-9"
              value={bu ?? ALL}
              onChange={(e) => setParam("bu", e.target.value)}
            >
              <option value={ALL}>Todas</option>
              <option value="cppem">CPPEM</option>
              <option value="unicive">UNICIVE</option>
              <option value="colegio_cppem">Colegio CPPEM</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Vendedor</label>
            <select
              className="input h-9"
              value={sellerId ?? ALL}
              onChange={(e) => setParam("seller_id", e.target.value)}
            >
              <option value={ALL}>Todos os vendedores</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active === false ? " (inativo)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <div className="text-sm font-semibold">
            {sales.length} venda{sales.length === 1 ? "" : "s"}
            <span className="text-white/40 mx-2">-</span>
            <span className="text-white/80">{BRL.format(totalValor)}</span>
            <span className="text-white/40 mx-2">-</span>
            <span className="text-white/80">{fmtInt.format(totalQtd)} un.</span>
          </div>
          <button
            className="btn-ghost h-9 px-3 text-xs"
            onClick={exportCsv}
            disabled={sales.length === 0}
            title="Exportar CSV"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table-stack w-full text-sm min-w-[1000px]">
            <thead className="text-xs uppercase tracking-wider text-white/40 bg-panel2">
              <tr className="text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Vendedor</th>
                <th className="p-3">BU</th>
                <th className="p-3">Produto</th>
                <th className="p-3">Cliente</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Indicacao</th>
                <th className="p-3">Observacao</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-white/50">
                    Nenhuma venda encontrada para esse filtro.
                  </td>
                </tr>
              )}
              {sales.map((s) => {
                const vendedor = sellerById.get(s.seller_id);
                const b = buFromProductLine(s.product_line);
                const lig = s.ligacao_status || "sem_ligacao";
                const ind = s.indicacao_status || "sem_indicacao";
                return (
                  <tr key={s.id} className="border-t border-border align-top">
                    <td data-label="Data" className="p-3 whitespace-nowrap">
                      {new Date(s.sale_date + "T00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td data-label="Vendedor" className="p-3 whitespace-nowrap font-medium">
                      {vendedor?.name || <span className="text-white/40">—</span>}
                    </td>
                    <td data-label="BU" className="p-3 whitespace-nowrap">
                      <span
                        className="chip"
                        style={{ background: BU_COLOR[b] + "22", color: BU_COLOR[b] }}
                      >
                        {BU_LABEL[b]}
                      </span>
                    </td>
                    <td data-label="Produto" className="p-3">{productLabel(s.product_line)}</td>
                    <td data-label="Cliente" className="p-3">
                      {s.cliente_nome ? (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-white/40" />
                          {s.cliente_nome}
                        </span>
                      ) : (
                        <span className="text-white/30 text-xs">—</span>
                      )}
                    </td>
                    <td data-label="Valor" className="p-3 text-right font-semibold whitespace-nowrap">
                      {BRL.format(Number(s.valor || 0))}
                    </td>
                    <td data-label="Qtd" className="p-3 text-right whitespace-nowrap">{s.quantidade}</td>
                    <td data-label="Origem" className="p-3 whitespace-nowrap">
                      <span
                        className="chip"
                        style={{
                          background: ligacaoColor(lig) + "22",
                          color: ligacaoColor(lig),
                        }}
                      >
                        <Phone className="w-3 h-3" /> {ligacaoShort(lig)}
                      </span>
                    </td>
                    <td data-label="Indicacao" className="p-3 whitespace-nowrap">
                      <span
                        className="chip"
                        style={{
                          background: indicacaoColor(ind) + "22",
                          color: indicacaoColor(ind),
                        }}
                      >
                        <UserPlus className="w-3 h-3" /> {indicacaoShort(ind)}
                      </span>
                    </td>
                    <td data-label="Observacao" className="p-3 text-white/70 text-xs max-w-[240px]">
                      {s.observacao || <span className="text-white/30">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
