"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X, Globe, Bot, MousePointerClick, Wallet, TrendingUp } from "lucide-react";
import NumberField from "@/components/NumberField";
import { BRL, fmtInt, todayISORecife } from "@/lib/calc";
import {
  PRODUCT_LINES_CPPEM,
  PRODUCT_LINES_UNICIVE,
  productLabel,
  type BU,
} from "@/lib/products";
import NewDiretoSaleModal, { type DiretoSale, type Channel } from "./NewDiretoSaleModal";
import VisitsModal from "./VisitsModal";

const MONTHS = [
  "Janeiro","Fevereiro","Marco","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function linesFor(channel: Channel, bu: BU): { id: string; label: string }[] {
  if (channel === "direto") return PRODUCT_LINES_CPPEM.map((l) => ({ id: l.id, label: l.label }));
  if (bu === "unicive") return PRODUCT_LINES_UNICIVE.map((l) => ({ id: l.id, label: l.label }));
  return PRODUCT_LINES_CPPEM.map((l) => ({ id: l.id, label: l.label }));
}

export default function DiretoClient({
  defaultYear,
  defaultMonth,
}: {
  defaultYear: number;
  defaultMonth: number;
}) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);

  const [list, setList] = useState<DiretoSale[]>([]);
  const [visits, setVisits] = useState<Record<string, number>>({});

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [visitsModalOpen, setVisitsModalOpen] = useState(false);

  useEffect(() => {
    loadSales();
    loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function loadSales() {
    const r = await fetch(`/api/direct/sales?year=${year}&month=${month}`);
    const j = await r.json();
    setList(j.data || []);
  }
  async function loadVisits() {
    const r = await fetch(`/api/direct/visits?year=${year}&month=${month}`);
    const j = await r.json();
    const map: Record<string, number> = {};
    for (const v of j.data || []) map[v.date] = Number(v.qty || 0);
    setVisits(map);
  }

  const totalValor = useMemo(() => list.reduce((a, b) => a + Number(b.valor || 0), 0), [list]);
  const totalQtd = useMemo(() => list.reduce((a, b) => a + Number(b.quantidade || 0), 0), [list]);
  const totalVisits = useMemo(() => Object.values(visits).reduce((a, b) => a + b, 0), [visits]);
  const totalDireto = useMemo(
    () => list.filter((s) => (s.channel || "direto") === "direto").reduce((a, b) => a + Number(b.valor || 0), 0),
    [list]
  );
  const totalIA = useMemo(
    () => list.filter((s) => s.channel === "ia").reduce((a, b) => a + Number(b.valor || 0), 0),
    [list]
  );

  return (
    <div className="space-y-4">
      {/* Barra de periodo + acoes */}
      <div className="card flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="label">Mes</label>
            <select
              className="input h-10 min-w-[140px]"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ano</label>
            <NumberField className="input h-10 w-24" value={year} onChange={setYear} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-ghost h-10" onClick={() => setVisitsModalOpen(true)}>
            <MousePointerClick className="w-4 h-4" /> Registrar visitas
          </button>
          <button className="btn-primary h-10" onClick={() => setSaleModalOpen(true)}>
            <Plus className="w-4 h-4" /> Nova venda
          </button>
        </div>
      </div>

      {/* KPIs do mes — leitura rapida */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="Faturamento total"
          value={BRL.format(totalValor)}
          hint={`${list.length} venda${list.length === 1 ? "" : "s"} · ${fmtInt.format(totalQtd)} un.`}
          accent="#c9ae7a"
        />
        <KpiCard
          icon={<Globe className="w-4 h-4" />}
          label="Direto (site)"
          value={BRL.format(totalDireto)}
          hint="CPPEM apenas"
          accent="#74aee0"
        />
        <KpiCard
          icon={<Bot className="w-4 h-4" />}
          label="IA (atendimento)"
          value={BRL.format(totalIA)}
          hint="CPPEM + UNICIVE"
          accent="#b99be0"
        />
        <KpiCard
          icon={<MousePointerClick className="w-4 h-4" />}
          label="Visitas no site"
          value={fmtInt.format(totalVisits)}
          hint="Base pra calculo de conversao"
          accent="#f59e0b"
        />
      </section>

      {/* Tabela de vendas */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-accent" />
            Vendas do mes (Direto + IA)
          </div>
          <div className="text-xs text-white/50">
            {list.length} venda{list.length === 1 ? "" : "s"} · {BRL.format(totalValor)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-panel2/60">
              <tr className="text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3">Obs</th>
                <th className="p-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-white/50 text-xs">
                    Nenhuma venda este mes. Clique em "Nova venda" pra lancar a primeira.
                  </td>
                </tr>
              )}
              {list.map((s) => (
                <Row
                  key={s.id}
                  sale={s}
                  onChange={(p) => setList((l) => l.map((x) => (x.id === s.id ? { ...x, ...p } : x)))}
                  onDelete={() => setList((l) => l.filter((x) => x.id !== s.id))}
                  onAfter={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      <NewDiretoSaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onCreated={(data) => {
          setList((l) => [data, ...l]);
          router.refresh();
        }}
        todayISO={todayISORecife()}
      />
      <VisitsModal
        open={visitsModalOpen}
        onClose={() => setVisitsModalOpen(false)}
        onSaved={(date, qty) => {
          setVisits((v) => ({ ...v, [date]: qty }));
          router.refresh();
        }}
        todayISO={todayISORecife()}
        initialVisits={visits}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-white/50 leading-tight">{label}</div>
        <div
          className="w-6 h-6 rounded-md grid place-items-center"
          style={{ background: accent + "22", color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold leading-none mt-1" style={{ color: accent }}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-white/50 mt-1 leading-tight">{hint}</div>}
    </div>
  );
}

function Row({
  sale,
  onChange,
  onDelete,
  onAfter,
}: {
  sale: DiretoSale;
  onChange: (p: Partial<DiretoSale>) => void;
  onDelete: () => void;
  onAfter: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [channel, setChannel] = useState<Channel>(sale.channel === "ia" ? "ia" : "direto");
  const [date, setDate] = useState(sale.sale_date);
  const [line, setLine] = useState(sale.product_line);
  const [valor, setValor] = useState(Number(sale.valor));
  const [qtd, setQtd] = useState(Number(sale.quantidade));
  const [obs, setObs] = useState(sale.observacao || "");
  const [buForIA, setBuForIA] = useState<BU>(
    (PRODUCT_LINES_UNICIVE as readonly { id: string }[]).some((p) => p.id === sale.product_line)
      ? "unicive"
      : "cppem"
  );

  const lineOptions = useMemo(() => linesFor(channel, buForIA), [channel, buForIA]);
  useEffect(() => {
    if (!lineOptions.some((o) => o.id === line)) setLine(lineOptions[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, buForIA]);

  async function save() {
    const r = await fetch(`/api/direct/sales/${sale.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sale_date: date, product_line: line, valor, quantidade: qtd, observacao: obs, channel }),
    });
    if (r.ok) {
      onChange({ sale_date: date, product_line: line, valor, quantidade: qtd, observacao: obs, channel });
      setEdit(false);
      onAfter();
    } else {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao salvar.");
    }
  }
  async function remove() {
    if (!confirm("Remover essa venda?")) return;
    const r = await fetch(`/api/direct/sales/${sale.id}`, { method: "DELETE" });
    if (r.ok) {
      onDelete();
      onAfter();
    }
  }

  if (!edit) {
    const isIA = sale.channel === "ia";
    return (
      <tr className="border-t border-border hover:bg-panel2/30">
        <td className="p-3 whitespace-nowrap">{new Date(sale.sale_date + "T00:00").toLocaleDateString("pt-BR")}</td>
        <td className="p-3">
          {isIA ? (
            <span className="chip" style={{ background: "#b99be022", color: "#b99be0" }}>
              <Bot className="w-3 h-3" /> IA
            </span>
          ) : (
            <span className="chip" style={{ background: "#74aee022", color: "#74aee0" }}>
              <Globe className="w-3 h-3" /> Direto
            </span>
          )}
        </td>
        <td className="p-3">{productLabel(sale.product_line)}</td>
        <td className="p-3 text-right font-semibold whitespace-nowrap">{BRL.format(Number(sale.valor))}</td>
        <td className="p-3 text-right">{sale.quantidade}</td>
        <td className="p-3 text-white/60 text-xs max-w-[220px] truncate">{sale.observacao || "-"}</td>
        <td className="p-3 text-right">
          <button className="btn-ghost h-8 px-2 mr-1" onClick={() => setEdit(true)}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button className="btn-danger h-8 px-2" onClick={remove}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border bg-panel2/40">
      <td className="p-2">
        <input type="date" className="input h-9" value={date} onChange={(e) => setDate(e.target.value)} />
      </td>
      <td className="p-2">
        <div className="flex flex-col gap-1">
          <select
            className="input h-9 text-xs"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
          >
            <option value="direto">Direto</option>
            <option value="ia">IA</option>
          </select>
          {channel === "ia" && (
            <select
              className="input h-9 text-xs"
              value={buForIA}
              onChange={(e) => setBuForIA(e.target.value as BU)}
            >
              <option value="cppem">CPPEM</option>
              <option value="unicive">UNICIVE</option>
            </select>
          )}
        </div>
      </td>
      <td className="p-2">
        <select className="input h-9" value={line} onChange={(e) => setLine(e.target.value)}>
          {lineOptions.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <NumberField step="0.01" className="input h-9" value={valor} onChange={setValor} />
      </td>
      <td className="p-2">
        <NumberField className="input h-9" value={qtd} onChange={setQtd} />
      </td>
      <td className="p-2">
        <input className="input h-9" value={obs} onChange={(e) => setObs(e.target.value)} />
      </td>
      <td className="p-2 text-right whitespace-nowrap">
        <button className="btn-primary h-8 px-2 mr-1" onClick={save}>
          <Check className="w-3.5 h-3.5" />
        </button>
        <button className="btn-ghost h-8 px-2" onClick={() => setEdit(false)}>
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
