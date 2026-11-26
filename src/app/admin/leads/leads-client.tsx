"use client";
/**
 * Leads (Configuracoes -> Leads), desde 26/11/2026: o admin informa so o TOTAL de
 * leads do mes ate agora de cada vendedor (antes era dia a dia). Alimenta a
 * conversao, o pace e a projecao de leads como antes (ver /api/leads/mes).
 */
import { useEffect, useMemo, useState } from "react";
import { RotateCw, Save } from "lucide-react";
import NumberField from "@/components/NumberField";
import { ALL_BUS, type BU } from "@/lib/products";
import { BU_LABEL, BU_COLOR, COLOR } from "@/lib/brand";

type Seller = { id: string; name: string; bu: BU; bus?: BU[] };

const MONTHS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function busOf(s: Seller): BU[] {
  const arr = Array.isArray(s.bus) ? s.bus.filter((x) => x === "cppem" || x === "unicive" || x === "colegio_cppem") : [];
  return arr.length > 0 ? Array.from(new Set(arr)) : [s.bu];
}

export default function LeadsClient({ sellers, defaultYear, defaultMonth }: { sellers: Seller[]; defaultYear: number; defaultMonth: number }) {
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [salvos, setSalvos] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  // Dado fresco ao montar e ao trocar o mes (no-store; ver nota do Router Cache no CLAUDE.md).
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setMsg(null);
    fetch(`/api/leads/mes?year=${year}&month=${month}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        const t: Record<string, number> = j.totais || {};
        setSalvos(t);
        setValores(t);
      })
      .catch(() => vivo && setMsg({ ok: false, t: "Nao foi possivel carregar os leads." }))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [year, month]);

  const alterados = useMemo(
    () => sellers.filter((s) => (valores[s.id] ?? 0) !== (salvos[s.id] ?? 0)).map((s) => s.id),
    [sellers, valores, salvos]
  );

  async function salvar() {
    if (alterados.length === 0) return;
    setSalvando(true);
    setMsg(null);
    const totais = Object.fromEntries(alterados.map((id) => [id, valores[id] ?? 0]));
    const r = await fetch("/api/leads/mes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ year, month, totais }),
    }).catch(() => null);
    setSalvando(false);
    if (r?.ok) {
      setSalvos((s) => ({ ...s, ...totais }));
      setMsg({ ok: true, t: "Leads do mes salvos." });
    } else {
      setMsg({ ok: false, t: "Houve um erro ao salvar." });
    }
  }

  const porBu = useMemo(() => {
    const out: Record<BU, Seller[]> = { cppem: [], unicive: [], colegio_cppem: [] };
    for (const s of sellers) (out[s.bu] || (out[s.bu] = [])).push(s);
    for (const k of Object.keys(out) as BU[]) out[k].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [sellers]);

  const total = sellers.reduce((a, s) => a + (valores[s.id] ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="panel sticky top-[7.25rem] z-10 flex flex-wrap items-center gap-2 p-3">
        <select className="input !w-36 !py-1.5 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <NumberField className="input !w-24 !py-1.5 text-sm" value={year} onChange={setYear} />
        <span className="text-xs text-white/50">Total do mes: <b className="text-white/85">{total.toLocaleString("pt-BR")}</b> leads</span>
        <div className="flex-1" />
        {alterados.length > 0 && !msg && <span className="text-xs" style={{ color: COLOR.warning }}>Alteracoes nao salvas</span>}
        {msg && <span className="text-xs" style={{ color: msg.ok ? COLOR.ok : COLOR.danger }}>{msg.t}</span>}
        <button className="btn-primary !py-1.5 text-sm" onClick={() => void salvar()} disabled={salvando || carregando || alterados.length === 0}>
          {salvando ? <RotateCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {sellers.length === 0 ? (
        <div className="panel py-6 text-center text-sm text-white/60">Cadastre vendedores primeiro.</div>
      ) : (
        ALL_BUS.map((bu) => {
          const rows = porBu[bu];
          if (!rows || rows.length === 0) return null;
          const color = BU_COLOR[bu];
          return (
            <section key={bu} className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--hair)] px-4 py-2.5">
                <i className="h-3.5 w-[3px] rounded-full" style={{ background: color }} />
                <span className="font-ui text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color }}>{BU_LABEL[bu]}</span>
                <span className="text-[11px] text-white/40">{rows.length} vendedor{rows.length === 1 ? "" : "es"}</span>
              </div>
              <table className="table-stack w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-white/40">
                  <tr className="text-left">
                    <th className="px-4 py-2">Vendedor</th>
                    <th className="px-4 py-2">Tambem atua em</th>
                    <th className="px-4 py-2 w-56">Leads no mes ate hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const outras = busOf(s).filter((b) => b !== s.bu);
                    const mudou = (valores[s.id] ?? 0) !== (salvos[s.id] ?? 0);
                    return (
                      <tr key={s.id} className="border-t border-[var(--hair)]">
                        <td data-label="Vendedor" className="px-4 py-2 font-medium">{s.name}</td>
                        <td data-label="Tambem atua em" className="px-4 py-2 text-[12px] text-white/50">
                          {outras.length === 0 ? "—" : outras.map((b) => BU_LABEL[b]).join(" · ")}
                        </td>
                        <td data-label="Leads no mes" className="px-4 py-2">
                          <NumberField
                            className={`input h-9 ${mudou ? "!border-accent" : ""}`}
                            min={0}
                            value={valores[s.id] ?? 0}
                            onChange={(v) => setValores((m) => ({ ...m, [s.id]: v }))}
                            disabled={carregando}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </div>
  );
}
