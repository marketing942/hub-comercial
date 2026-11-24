"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, RotateCw, Wand2 } from "lucide-react";

import NumberField from "@/components/NumberField";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { COLOR } from "@/lib/brand";
import { ALL_BUS, type BU } from "@/lib/products";
import type { CategoriaMeta, MetasLinhaResposta } from "@/lib/ca/metasLinhaTipos";

const BU_NOME: Record<BU, string> = { cppem: "CPPEM", unicive: "UNICIVE", colegio_cppem: "Colégio" };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Edit = { valor: number; qtd: number };

export default function MetasLinhaClient({ defaultYear, defaultMonth }: { defaultYear: number; defaultMonth: number }) {
  const [bu, setBu] = useState<BU>("cppem");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [dados, setDados] = useState<MetasLinhaResposta | null>(null);
  const [edit, setEdit] = useState<Record<string, Edit>>({});
  const [carregando, setCarregando] = useState(true);
  const [sujo, setSujo] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async (manterMsg = false) => {
    setCarregando(true);
    if (!manterMsg) setMsg(null);
    try {
      const r = await fetch(`/api/ca/metas?bu=${bu}&year=${year}&month=${month}`, { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Falha ao carregar.");
      const j = (await r.json()) as MetasLinhaResposta;
      setDados(j);
      setEdit(Object.fromEntries(j.categorias.map((c) => [c.id, { valor: c.meta_valor, qtd: c.meta_qtd }])));
      setSujo(false);
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setCarregando(false);
    }
  }, [bu, year, month]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function mudar(id: string, campo: keyof Edit, v: number) {
    setEdit((e) => ({ ...e, [id]: { ...(e[id] ?? { valor: 0, qtd: 0 }), [campo]: v } }));
    setSujo(true);
    setMsg(null);
  }

  // Preenche, so nas categorias SEM meta, o que vem das metas antigas (para revisar e salvar).
  function usarAntigas() {
    if (!dados) return;
    setEdit((e) => {
      const n = { ...e };
      for (const c of dados.categorias) {
        const atual = n[c.id] ?? { valor: 0, qtd: 0 };
        if (atual.valor === 0 && atual.qtd === 0 && (c.antiga_valor || c.antiga_qtd)) n[c.id] = { valor: c.antiga_valor, qtd: c.antiga_qtd };
      }
      return n;
    });
    setSujo(true);
    setMsg({ tipo: "ok", texto: "Metas antigas preenchidas nas categorias sem meta. Revise e clique em Salvar." });
  }

  async function salvar() {
    if (!dados) return;
    setMsg(null);
    const r = await fetch("/api/ca/metas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bu,
        year,
        month,
        metas: dados.categorias.map((c) => ({ categoria_id: c.id, valor_meta: edit[c.id]?.valor ?? 0, quantidade_meta: edit[c.id]?.qtd ?? 0 })),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg({ tipo: "erro", texto: j.error || "Erro ao salvar." });
      return;
    }
    setSujo(false);
    setMsg({ tipo: "ok", texto: "Metas salvas ✓" });
    void carregar(true);
  }

  const totais = useMemo(() => {
    const cs = dados?.categorias ?? [];
    return {
      meta: cs.reduce((s, c) => s + (edit[c.id]?.valor ?? 0), 0),
      real: cs.reduce((s, c) => s + c.realizado, 0),
    };
  }, [dados, edit]);
  const temAntigas = !!dados?.categorias.some((c) => c.antiga_valor || c.antiga_qtd);

  return (
    <div className="space-y-4">
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-panel border border-border">
          {ALL_BUS.map((b) => (
            <button
              key={b}
              onClick={() => setBu(b)}
              className={`px-4 py-1.5 rounded-lg font-ui text-[13px] font-bold uppercase tracking-wider transition ${
                b === bu ? "bg-accent text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {BU_NOME[b]}
            </button>
          ))}
        </div>
        <select className="input !w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select className="input !w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[defaultYear - 1, defaultYear, defaultYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {temAntigas && (
            <button className="btn-ghost" onClick={usarAntigas} title="Preenche as categorias sem meta com as metas antigas equivalentes">
              <Wand2 className="w-4 h-4" /> Usar metas antigas
            </button>
          )}
          <button className="btn-ghost" onClick={() => void carregar()} aria-label="Recarregar">
            <RotateCw className="w-4 h-4" />
          </button>
          <button className="btn-primary" onClick={() => void salvar()} disabled={!sujo || carregando}>
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>

      {msg && (
        <div className="panel px-4 py-2.5 text-sm" style={{ color: msg.tipo === "ok" ? COLOR.ok : COLOR.danger }}>
          {msg.texto}
        </div>
      )}
      {sujo && !msg && <div className="text-xs" style={{ color: COLOR.warning }}>Alterações não salvas.</div>}

      {dados?.semTabela && (
        <div className="panel p-4 text-sm" style={{ borderColor: "rgba(240,180,76,0.45)" }}>
          <div className="eyebrow-label" style={{ color: COLOR.warning }}>Falta criar a tabela</div>
          <p className="mt-1.5 text-white/70">
            Rode <b>supabase/ca-04-metas-linha.sql</b> no SQL Editor do Supabase. Enquanto isso não dá para salvar.
          </p>
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-stack w-full text-sm min-w-[820px]">
            <thead>
              <tr className="font-ui text-[11px] uppercase tracking-[.14em] text-white/40 border-b border-[var(--hair)]">
                <th className="px-4 py-3 text-left font-semibold">Categoria do Conta Azul</th>
                <th className="px-3 py-3 text-right font-semibold">Realizado</th>
                <th className="px-3 py-3 text-right font-semibold">Meta (R$)</th>
                <th className="px-3 py-3 text-right font-semibold">Meta (qtd)</th>
                <th className="px-3 py-3 text-right font-semibold">% da meta</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={5} className="p-6 text-center text-white/50">Carregando…</td></tr>
              )}
              {!carregando && (dados?.categorias.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-white/50">
                    Nenhuma categoria do Conta Azul nesta BU ainda. Classifique as categorias em Configurações → Classificação.
                  </td>
                </tr>
              )}
              {!carregando &&
                dados?.categorias.map((c: CategoriaMeta) => {
                  const e = edit[c.id] ?? { valor: 0, qtd: 0 };
                  const pct = e.valor > 0 ? (c.realizado / e.valor) * 100 : e.qtd > 0 ? (c.qtd / e.qtd) * 100 : 0;
                  const tem = e.valor > 0 || e.qtd > 0;
                  return (
                    <tr key={c.id} className="border-t border-[var(--hair)]">
                      <td data-label="Categoria" className="px-4 py-2.5 font-medium">{c.nome}</td>
                      <td data-label="Realizado" className="px-3 py-2.5 text-right tabular-nums text-white/70">
                        {BRL.format(c.realizado)}
                        <span className="block text-[11px] text-white/35">{fmtInt.format(c.qtd)} un.</span>
                      </td>
                      <td data-label="Meta (R$)" className="px-3 py-2">
                        <NumberField className="input !py-1.5 text-right tabular-nums" step="0.01" min={0} value={e.valor} onChange={(v) => mudar(c.id, "valor", v)} />
                      </td>
                      <td data-label="Meta (qtd)" className="px-3 py-2">
                        <NumberField className="input !py-1.5 text-right tabular-nums" min={0} value={e.qtd} onChange={(v) => mudar(c.id, "qtd", v)} />
                      </td>
                      <td data-label="% da meta" className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: !tem ? COLOR.mute : pct >= 100 ? COLOR.ok : COLOR.neutral }}>
                        {tem ? fmtPct(pct) : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {!carregando && (dados?.categorias.length ?? 0) > 0 && (
              <tfoot>
                <tr className="border-t border-[var(--hair)] font-semibold">
                  <td className="px-4 py-3">Total da BU</td>
                  <td className="px-3 py-3 text-right tabular-nums">{BRL.format(totais.real)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{BRL.format(totais.meta)}</td>
                  <td />
                  <td className="px-3 py-3 text-right tabular-nums">{totais.meta > 0 ? fmtPct((totais.real / totais.meta) * 100) : "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
