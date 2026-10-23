"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  productLabel,
  productLinesFor,
  type BU,
  LIGACAO_STATUSES,
  ligacaoShort,
  ligacaoColor,
  INDICACAO_STATUSES,
  indicacaoShort,
  indicacaoColor,
  PRODUCT_LINES_CPPEM,
  PRODUCT_LINES_COLEGIO,
} from "@/lib/products";
import { BRL, fmtInt, todayISORecife } from "@/lib/calc";
import { Plus, Pencil, Trash2, Check, X, Phone, UserPlus } from "lucide-react";
import NumberField from "@/components/NumberField";
import NewSaleModal from "./NewSaleModal";

type Sale = {
  id: string;
  sale_date: string;
  product_line: string;
  valor: number;
  quantidade: number;
  cliente_nome?: string | null;
  observacao?: string | null;
  ligacao_status?: string | null;
  indicacao_status?: string | null;
};

type Seller = { id: string; name: string; bu: BU; bus?: BU[] };

function busOf(s: Seller): BU[] {
  const arr = Array.isArray(s.bus) ? s.bus : [];
  return arr.length > 0 ? arr : [s.bu];
}

function todayISO() {
  // Usa o fuso de Recife — toISOString() entrega UTC e, apos ~21h local,
  // ja vira pro dia seguinte, fazendo o vendedor lancar venda com data
  // errada sem perceber.
  return todayISORecife();
}

export default function SalesClient({ seller, initial }: { seller: Seller; initial: Sale[] }) {
  const router = useRouter();
  const [list, setList] = useState<Sale[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);

  const sellerBus = busOf(seller);
  const hasCppem = sellerBus.includes("cppem");
  const hasUnicive = sellerBus.includes("unicive");
  const hasColegio = sellerBus.includes("colegio_cppem");
  const selectLines: { id: string; label: string; group?: string }[] = [];
  if (hasCppem) {
    PRODUCT_LINES_CPPEM.forEach((l) =>
      selectLines.push({ id: l.id, label: l.label, group: "CPPEM" })
    );
  }
  if (hasUnicive) {
    selectLines.push({ id: "matriculas", label: "Matriculas Unicive", group: "UNICIVE" });
  }
  if (hasColegio) {
    PRODUCT_LINES_COLEGIO.forEach((l) =>
      selectLines.push({ id: l.id, label: l.label, group: "Colegio CPPEM" })
    );
  }

  const totalValor = useMemo(() => list.reduce((a, b) => a + Number(b.valor || 0), 0), [list]);
  const totalQtd = useMemo(() => list.reduce((a, b) => a + Number(b.quantidade || 0), 0), [list]);

  return (
    <div className="space-y-4">
      {/* Botao principal: abre o modal/wizard */}
      <div className="card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Lancar nova venda</div>
          <div className="text-xs text-white/50">
            Preencha o passo-a-passo pra registrar sua venda sem erros ou duplicatas.
          </div>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Nova venda
        </button>
      </div>

      <NewSaleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(data) => {
          setList((l) => [data as Sale, ...l]);
          router.refresh();
        }}
        todayISO={todayISORecife()}
        sellerBus={sellerBus}
        selectLines={selectLines}
      />

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="text-sm font-semibold">Vendas do mes</div>
          <div className="text-xs text-white/60">
            {list.length} venda{list.length === 1 ? "" : "s"} - {BRL.format(totalValor)} - {fmtInt.format(totalQtd)}{" "}
            unidade{totalQtd === 1 ? "" : "s"}
          </div>
        </div>
        <table className="table-stack w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-white/40 bg-panel2">
            <tr className="text-left">
              <th className="p-3">Data</th>
              <th className="p-3">Produto</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Qtd</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Indicacao</th>
              <th className="p-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-white/50">
                  Nenhuma venda este mes. Lance a primeira acima.
                </td>
              </tr>
            )}
            {list.map((s) => (
              <Row
                key={s.id}
                sale={s}
                bus={sellerBus}
                onChange={(p) => setList((l) => l.map((x) => (x.id === s.id ? { ...x, ...p } : x)))}
                onDelete={() => setList((l) => l.filter((x) => x.id !== s.id))}
                onAfter={() => router.refresh()}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  sale,
  bus,
  onChange,
  onDelete,
  onAfter,
}: {
  sale: Sale;
  bus: BU[];
  onChange: (p: Partial<Sale>) => void;
  onDelete: () => void;
  onAfter: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState(sale.sale_date);
  const [line, setLine] = useState(sale.product_line);
  const [valor, setValor] = useState(Number(sale.valor));
  const [qtd, setQtd] = useState(Number(sale.quantidade));
  const [cliente, setCliente] = useState(sale.cliente_nome || "");
  const [ligacao, setLigacao] = useState(sale.ligacao_status || "sem_ligacao");
  const [indicacao, setIndicacao] = useState(sale.indicacao_status || "sem_indicacao");

  const cppemLines = PRODUCT_LINES_CPPEM.map((p) => ({ id: p.id, label: p.label }));
  const uniLines = [{ id: "matriculas", label: "Matriculas Unicive" }];
  const colegioLines = PRODUCT_LINES_COLEGIO.map((p) => ({ id: p.id, label: p.label }));
  const lines: { id: string; label: string }[] = [];
  if (bus.includes("cppem")) lines.push(...cppemLines);
  if (bus.includes("unicive")) lines.push(...uniLines);
  if (bus.includes("colegio_cppem")) lines.push(...colegioLines);

  async function save() {
    const r = await fetch(`/api/sales/${sale.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sale_date: date,
        product_line: line,
        valor,
        quantidade: qtd,
        cliente_nome: cliente,
        ligacao_status: ligacao,
        indicacao_status: indicacao,
      }),
    });
    if (r.ok) {
      onChange({
        sale_date: date,
        product_line: line,
        valor,
        quantidade: qtd,
        cliente_nome: cliente || null,
        ligacao_status: ligacao,
        indicacao_status: indicacao,
      });
      setEdit(false);
      onAfter();
    }
  }

  async function remove() {
    if (!confirm("Remover essa venda?")) return;
    const r = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
    if (r.ok) {
      onDelete();
      onAfter();
    }
  }

  if (!edit) {
    const lig = sale.ligacao_status || "sem_ligacao";
    const ind = sale.indicacao_status || "sem_indicacao";
    return (
      <tr className="border-t border-border">
        <td data-label="Data" className="p-3">{new Date(sale.sale_date + "T00:00").toLocaleDateString("pt-BR")}</td>
        <td data-label="Produto" className="p-3">{productLabel(sale.product_line)}</td>
        <td data-label="Cliente" className="p-3">
          {sale.cliente_nome
            ? <span className="text-white/90">{sale.cliente_nome}</span>
            : <span className="text-white/30 text-xs">—</span>}
        </td>
        <td data-label="Valor" className="p-3 font-semibold">{BRL.format(Number(sale.valor))}</td>
        <td data-label="Qtd" className="p-3">{sale.quantidade}</td>
        <td data-label="Origem" className="p-3">
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
        <td data-label="Indicacao" className="p-3">
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
        <td data-label="" className="p-3 text-right">
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
      <td data-label="Data" className="p-2">
        <input type="date" className="input h-9" value={date} max={todayISORecife()} onChange={(e) => setDate(e.target.value)} />
      </td>
      <td data-label="Produto" className="p-2">
        <select className="input h-9" value={line} onChange={(e) => setLine(e.target.value)}>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Cliente" className="p-2">
        <input
          type="text"
          className="input h-9"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Cliente"
          maxLength={200}
        />
      </td>
      <td data-label="Valor" className="p-2">
        <NumberField step="0.01" className="input h-9" value={valor} onChange={setValor} />
      </td>
      <td data-label="Qtd" className="p-2">
        <NumberField className="input h-9" value={qtd} onChange={setQtd} />
      </td>
      <td data-label="Origem" className="p-2">
        <select className="input h-9" value={ligacao} onChange={(e) => setLigacao(e.target.value)}>
          {LIGACAO_STATUSES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.short}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Indicacao" className="p-2">
        <select className="input h-9" value={indicacao} onChange={(e) => setIndicacao(e.target.value)}>
          {INDICACAO_STATUSES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.short}
            </option>
          ))}
        </select>
      </td>
      <td data-label="" className="p-2 text-right">
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
