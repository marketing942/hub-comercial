"use client";
import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import NumberField from "@/components/NumberField";
import { ALL_BUS, type BU } from "@/lib/products";
import { BU_LABEL, BU_COLOR } from "@/lib/brand";

type Seller = {
  id: string;
  name: string;
  bu: BU;
  bus?: BU[];
};

const MONTHS = [
  "Janeiro","Fevereiro","Marco","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function busOf(s: Seller): BU[] {
  const arr = Array.isArray(s.bus)
    ? s.bus.filter((x) => x === "cppem" || x === "unicive" || x === "colegio_cppem")
    : [];
  return arr.length > 0 ? Array.from(new Set(arr)) : [s.bu];
}

export default function LeadsClient({
  sellers,
  defaultYear,
  defaultMonth,
}: {
  sellers: Seller[];
  defaultYear: number;
  defaultMonth: number;
}) {
  const [date, setDate] = useState(todayISO());
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [values, setValues] = useState<Record<string, number>>({});
  const [monthly, setMonthly] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(
      sellers.map((s) =>
        fetch(`/api/leads?seller_id=${s.id}&year=${year}&month=${month}`).then((r) => r.json())
      )
    ).then((all) => {
      const sum: Record<string, number> = {};
      const day: Record<string, number> = {};
      all.forEach((j: any, idx) => {
        const sellerId = sellers[idx].id;
        sum[sellerId] = (j.data || []).reduce((a: number, b: any) => a + Number(b.qty || 0), 0);
        day[sellerId] = (j.data || []).find((x: any) => x.date === date)?.qty || 0;
      });
      setMonthly(sum);
      setValues(day);
    });
  }, [date, year, month, sellers]);

  async function save() {
    setSaving(true);
    setSaved(null);
    const results = await Promise.all(
      sellers.map((s) =>
        fetch("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seller_id: s.id, date, qty: Number(values[s.id] || 0) }),
        })
      )
    );
    setSaving(false);
    if (results.every((r) => r.ok)) {
      setSaved("Leads do dia salvos!");
      setTimeout(() => setSaved(null), 2000);
      const refreshed = await Promise.all(
        sellers.map((s) =>
          fetch(`/api/leads?seller_id=${s.id}&year=${year}&month=${month}`).then((r) => r.json())
        )
      );
      const sum: Record<string, number> = {};
      refreshed.forEach((j: any, idx) => {
        sum[sellers[idx].id] = (j.data || []).reduce(
          (a: number, b: any) => a + Number(b.qty || 0),
          0
        );
      });
      setMonthly(sum);
    } else {
      setSaved("Houve algum erro ao salvar.");
    }
  }

  const grouped = useMemo(() => {
    const out: Record<BU, Seller[]> = { cppem: [], unicive: [], colegio_cppem: [] };
    for (const s of sellers) {
      const arr = out[s.bu] || (out[s.bu] = []);
      arr.push(s);
    }
    for (const k of Object.keys(out) as BU[]) {
      out[k].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [sellers]);

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">Data</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              const d = new Date(e.target.value);
              setYear(d.getFullYear());
              setMonth(d.getMonth() + 1);
            }}
          />
        </div>
        <div>
          <label className="label">Mes de referencia</label>
          <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ano</label>
          <NumberField className="input" value={year} onChange={setYear} />
        </div>
        <button className="btn-primary" disabled={saving} onClick={save}>
          <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar leads do dia"}
        </button>
        {saved && <div className="md:col-span-4 text-xs text-success">{saved}</div>}
      </div>

      {sellers.length === 0 ? (
        <div className="card text-sm text-white/60 text-center py-6">
          Cadastre vendedores primeiro.
        </div>
      ) : (
        ALL_BUS.map((bu) => {
          const rows = grouped[bu];
          const color = BU_COLOR[bu];
          return (
            <section key={bu} className="space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: color + "22", color }}
                >
                  {BU_LABEL[bu]}
                </div>
                <div className="flex-1 h-px" style={{ background: color + "33" }} />
                <div className="text-[11px] text-white/40">
                  {rows.length} vendedor{rows.length === 1 ? "" : "es"}
                </div>
              </div>

              <div className="card p-0 overflow-hidden">
                <table className="table-stack w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-panel2/60">
                    <tr className="text-left">
                      <th className="p-3">Vendedor</th>
                      <th className="p-3">Tambem atua em</th>
                      <th className="p-3 w-44">Leads no dia</th>
                      <th className="p-3 w-32">Total no mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-white/40 text-xs">
                          Nenhum vendedor nesta BU.
                        </td>
                      </tr>
                    )}
                    {rows.map((s) => {
                      const sBus = busOf(s);
                      const outras = sBus.filter((b) => b !== s.bu);
                      return (
                        <tr key={s.id} className="border-t border-border">
                          <td data-label="Vendedor" className="p-3 font-medium">{s.name}</td>
                          <td data-label="Tambem atua em" className="p-3">
                            {outras.length === 0 ? (
                              <span className="text-[11px] text-white/30">—</span>
                            ) : (
                              <div className="flex gap-1.5 flex-wrap">
                                {outras.map((b) => (
                                  <span
                                    key={b}
                                    className={
                                      b === "cppem"
                                        ? "chip-cppem"
                                        : b === "unicive"
                                        ? "chip-unicive"
                                        : "chip-colegio"
                                    }
                                  >
                                    {BU_LABEL[b]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td data-label="Leads no dia" className="p-3">
                            <NumberField
                              className="input h-9"
                              min={0}
                              value={values[s.id] ?? 0}
                              onChange={(v) => setValues((m) => ({ ...m, [s.id]: v }))}
                            />
                          </td>
                          <td data-label="Total no mes" className="p-3 font-semibold">{monthly[s.id] ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
