"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, RotateCw, Save, SplitSquareHorizontal, Wand2 } from "lucide-react";

import NumberField from "@/components/NumberField";
import { BU_COLOR, BU_LABEL, COLOR } from "@/lib/brand";
import { ALL_BUS, isQtdPrimary, type BU } from "@/lib/products";
import type { CategoriaMeta, MetasLinhaResposta } from "@/lib/ca/metasLinhaTipos";

type Seller = { id: string; name: string; bu: BU; bus?: BU[]; active?: boolean };
type SellerGoal = {
  seller_id: string;
  valor_meta: number;
  quantidade_meta: number;
  ticket_medio_meta: number;
  taxa_conversao_meta: number;
};
type LineEdit = { valor: number; qtd: number };

const MONTHS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const BRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(n);
const INT = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const PCT = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const vazioMeta = (id: string): SellerGoal => ({ seller_id: id, valor_meta: 0, quantidade_meta: 0, ticket_medio_meta: 0, taxa_conversao_meta: 0 });

/**
 * Metas do mes — UMA tela, tres niveis, nesta ordem:
 *  1. Meta TOTAL da BU      (soma das linhas que contam p/ vendedor + leads e conversao)
 *  2. Meta por LINHA de receita (categorias do Conta Azul)
 *  3. Meta por VENDEDOR
 * Um botao Salvar grava os tres.
 */
export default function GoalsClient({ sellers, defaultYear, defaultMonth }: { sellers: Seller[]; defaultYear: number; defaultMonth: number }) {
  const [bu, setBu] = useState<BU>("cppem");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);

  const [linhas, setLinhas] = useState<MetasLinhaResposta | null>(null);
  const [lineEdit, setLineEdit] = useState<Record<string, LineEdit>>({});
  const [goals, setGoals] = useState<Record<string, SellerGoal>>({});
  const [metaLeads, setMetaLeads] = useState(0);
  const [metaConv, setMetaConv] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const buSellers = useMemo(
    () => sellers.filter((s) => (Array.isArray(s.bus) && s.bus.length > 0 ? s.bus : [s.bu]).includes(bu)),
    [sellers, bu]
  );
  const isQtd = isQtdPrimary(bu);
  const showQtdCol = isQtd || bu === "unicive";
  const color = BU_COLOR[bu];

  const carregar = useCallback(
    async (alvo?: { year: number; month: number }) => {
      const y = alvo?.year ?? year;
      const m = alvo?.month ?? month;
      const [rl, rp] = await Promise.all([
        fetch(`/api/ca/metas?bu=${bu}&year=${y}&month=${m}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/goals/period?bu=${bu}&year=${y}&month=${m}`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      return { rl: rl as MetasLinhaResposta, rp };
    },
    [bu, year, month]
  );

  function aplicar(rl: MetasLinhaResposta, rp: any) {
    setLinhas(rl);
    setLineEdit(Object.fromEntries((rl.categorias ?? []).map((c: CategoriaMeta) => [c.id, { valor: c.meta_valor, qtd: c.meta_qtd }])));
    const next: Record<string, SellerGoal> = {};
    buSellers.forEach((s) => {
      const g = (rp.monthly || []).find((x: any) => x.seller_id === s.id);
      next[s.id] = {
        seller_id: s.id,
        valor_meta: Number(g?.valor_meta || 0),
        quantidade_meta: Number(g?.quantidade_meta || 0),
        ticket_medio_meta: Number(g?.ticket_medio_meta || 0),
        taxa_conversao_meta: Number(g?.taxa_conversao_meta || 0),
      };
    });
    setGoals(next);
    setMetaLeads(Number(rp?.bu_leads_meta || 0));
    setMetaConv(Number(rp?.bu_taxa_conversao_meta || 0));
    setDirty(false);
  }

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setFeedback(null);
    carregar()
      .then(({ rl, rp }) => vivo && aplicar(rl, rp))
      .catch(() => vivo && setFeedback({ kind: "err", msg: "Nao foi possivel carregar as metas." }))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bu, year, month]);

  const cats = linhas?.categorias ?? [];
  // Meta TOTAL = soma das linhas que contam para vendedor (e a meta do placar da BU).
  const totalLinhas = useMemo(() => {
    let valor = 0;
    let qtd = 0;
    for (const c of cats) if (c.conta) {
      valor += lineEdit[c.id]?.valor ?? 0;
      qtd += lineEdit[c.id]?.qtd ?? 0;
    }
    return { valor, qtd };
  }, [cats, lineEdit]);
  const totalGrupo = useMemo(() => cats.filter((c) => !c.conta).reduce((s, c) => s + (lineEdit[c.id]?.valor ?? 0), 0), [cats, lineEdit]);
  const totalVend = useMemo(
    () => ({
      fat: Object.values(goals).reduce((a, b) => a + b.valor_meta, 0),
      qtd: Object.values(goals).reduce((a, b) => a + b.quantidade_meta, 0),
    }),
    [goals]
  );
  const metaPrincipal = isQtd ? totalLinhas.qtd : totalLinhas.valor;
  const vendPrincipal = isQtd ? totalVend.qtd : totalVend.fat;
  const diff = vendPrincipal - metaPrincipal;

  function mudarLinha(id: string, campo: keyof LineEdit, v: number) {
    setLineEdit((e) => ({ ...e, [id]: { ...(e[id] ?? { valor: 0, qtd: 0 }), [campo]: v } }));
    setDirty(true);
    setFeedback(null);
  }
  function mudarVend(id: string, patch: Partial<SellerGoal>) {
    setGoals((p) => ({ ...p, [id]: { ...(p[id] || vazioMeta(id)), ...patch } }));
    setDirty(true);
    setFeedback(null);
  }

  function usarAntigas() {
    setLineEdit((e) => {
      const n = { ...e };
      for (const c of cats) {
        const a = n[c.id] ?? { valor: 0, qtd: 0 };
        if (a.valor === 0 && a.qtd === 0 && (c.antiga_valor || c.antiga_qtd)) n[c.id] = { valor: c.antiga_valor, qtd: c.antiga_qtd };
      }
      return n;
    });
    setDirty(true);
    setFeedback({ kind: "ok", msg: "Metas antigas preenchidas nas linhas sem meta. Revise e salve." });
  }

  function distribuirIgual() {
    if (buSellers.length === 0) return;
    const perFat = totalLinhas.valor / buSellers.length;
    const perQtd = totalLinhas.qtd / buSellers.length;
    setGoals((prev) => {
      const next = { ...prev };
      buSellers.forEach((s) => {
        next[s.id] = { ...(next[s.id] || vazioMeta(s.id)), valor_meta: Math.round(perFat * 100) / 100, quantidade_meta: Math.round(perQtd) };
      });
      return next;
    });
    setDirty(true);
  }

  async function copiarMesAnterior() {
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    setLoading(true);
    try {
      const { rl, rp } = await carregar({ year: py, month: pm });
      aplicar(rl, rp);
      setDirty(true);
      setFeedback({ kind: "ok", msg: "Metas copiadas do mes anterior. Revise e salve." });
    } catch {
      setFeedback({ kind: "err", msg: "Nao foi possivel copiar." });
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    setSaving(true);
    setFeedback(null);
    try {
      const r1 = await fetch("/api/ca/metas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bu, year, month,
          metas: cats.map((c) => ({ categoria_id: c.id, valor_meta: lineEdit[c.id]?.valor ?? 0, quantidade_meta: lineEdit[c.id]?.qtd ?? 0 })),
        }),
      });
      if (!r1.ok) throw new Error((await r1.json().catch(() => ({}))).error || "Erro ao salvar as linhas.");
      const r2 = await fetch("/api/goals/period", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bu, year, month, sellers: Object.values(goals), bu_leads_meta: metaLeads, bu_taxa_conversao_meta: metaConv }),
      });
      if (!r2.ok) throw new Error((await r2.json().catch(() => ({}))).error || "Erro ao salvar os vendedores.");
      setDirty(false);
      setFeedback({ kind: "ok", msg: "Metas salvas ✓" });
    } catch (e) {
      setFeedback({ kind: "err", msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const temAntigas = cats.some((c) => c.antiga_valor || c.antiga_qtd);
  const secao = "panel p-5";
  const titulo = (n: number, t: string, d: string) => (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent font-ui text-[12px] font-bold text-black">{n}</span>
        <h2 className="font-display text-lg font-bold">{t}</h2>
      </div>
      <p className="mt-1 text-xs text-white/50">{d}</p>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Barra unica: BU + mes + atalhos + Salvar */}
      <div className="panel sticky top-[7.25rem] z-10 flex flex-wrap items-center gap-2 p-3 sm:top-[7.25rem]">
        <div className="inline-flex rounded-xl border border-border bg-panel p-1">
          {ALL_BUS.map((b) => (
            <button
              key={b}
              onClick={() => setBu(b)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${bu === b ? "bg-accent text-black" : "text-white/60 hover:text-white"}`}
            >
              {BU_LABEL[b]}
            </button>
          ))}
        </div>
        <select className="input !w-36 !py-1.5 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <NumberField className="input !w-24 !py-1.5 text-sm" value={year} onChange={setYear} />
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => void copiarMesAnterior()} disabled={loading} title="Copia as metas do mes anterior">
          <Copy className="h-3.5 w-3.5" /> Copiar mes anterior
        </button>
        <div className="flex-1" />
        {dirty && !feedback && <span className="text-xs" style={{ color: COLOR.warning }}>Alterações não salvas</span>}
        {feedback && <span className="text-xs" style={{ color: feedback.kind === "ok" ? COLOR.ok : COLOR.danger }}>{feedback.msg}</span>}
        <button className="btn-primary !py-1.5 text-sm" onClick={() => void salvar()} disabled={saving || loading || !dirty}>
          {saving ? <RotateCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar tudo"}
        </button>
      </div>

      {linhas?.semTabela && (
        <div className="panel p-4 text-sm" style={{ borderColor: "rgba(240,180,76,0.45)" }}>
          <div className="eyebrow-label" style={{ color: COLOR.warning }}>Falta criar a tabela</div>
          <p className="mt-1.5 text-white/70">Rode <b>supabase/ca-04-metas-linha.sql</b> no SQL Editor do Supabase para salvar as metas por linha.</p>
        </div>
      )}

      {/* 1 · META TOTAL */}
      <section className={secao}>
        {titulo(1, `Meta total — ${BU_LABEL[bu]}`, "É a meta do placar da BU no Dashboard TV: a soma das metas por linha que contam para vendedor (seção 2). Leads e conversão são da BU inteira.")}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <div className="label">{isQtd ? "Matrículas (qtd)" : "Faturamento (R$)"}</div>
            <div className="font-display text-2xl font-bold tabular-nums" style={{ color }}>{isQtd ? INT(totalLinhas.qtd) : BRL(totalLinhas.valor)}</div>
            <div className="mt-1 text-[11px] text-white/40">
              {isQtd ? `Faturamento: ${BRL(totalLinhas.valor)}` : showQtdCol ? `Matrículas: ${INT(totalLinhas.qtd)}` : ""}
            </div>
          </div>
          <div>
            <div className="label">Só na Gestão a Vista</div>
            <div className="font-display text-2xl font-bold tabular-nums text-white/70">{BRL(totalGrupo)}</div>
            <div className="mt-1 text-[11px] text-white/40">Linhas que não contam p/ vendedor</div>
          </div>
          <div>
            <div className="label">Meta de leads (mês)</div>
            <NumberField className="input text-lg font-bold" value={metaLeads} onChange={(v) => { setMetaLeads(v); setDirty(true); }} />
          </div>
          <div>
            <div className="label">Meta de conversão (%)</div>
            <NumberField className="input text-lg font-bold" step="0.1" value={metaConv} onChange={(v) => { setMetaConv(v); setDirty(true); }} />
          </div>
        </div>
      </section>

      {/* 2 · META POR LINHA DE RECEITA */}
      <section className={secao}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {titulo(2, "Meta por linha de receita", "Uma meta para cada categoria do Conta Azul desta BU. “Conta p/ vendedor” entra na meta total; as demais aparecem só na Gestão a Vista.")}
          {temAntigas && (
            <button className="btn-ghost !py-1.5 text-xs" onClick={usarAntigas} title="Preenche as linhas sem meta com as metas antigas equivalentes">
              <Wand2 className="h-4 w-4" /> Usar metas antigas
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table-stack w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--hair)] font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
                <th className="py-2 text-left font-semibold">Categoria do Conta Azul</th>
                <th className="py-2 text-right font-semibold">Realizado</th>
                <th className="py-2 text-right font-semibold">Meta (R$)</th>
                <th className="py-2 text-right font-semibold">Meta (qtd)</th>
                <th className="py-2 text-right font-semibold">% da meta</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-6 text-center text-white/50">Carregando…</td></tr>}
              {!loading && cats.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-white/50">Nenhuma categoria do Conta Azul nesta BU ainda. Classifique as categorias em Configurações → Classificação.</td></tr>
              )}
              {!loading && cats.map((c) => {
                const e = lineEdit[c.id] ?? { valor: 0, qtd: 0 };
                const tem = e.valor > 0 || e.qtd > 0;
                const pct = e.valor > 0 ? (c.realizado / e.valor) * 100 : e.qtd > 0 ? (c.qtd / e.qtd) * 100 : 0;
                return (
                  <tr key={c.id} className="border-t border-[var(--hair)]">
                    <td data-label="Categoria" className="py-2 pr-3 font-medium">
                      {c.nome}
                      <span className="ml-2 rounded-full px-2 py-0.5 font-ui text-[10px] font-bold uppercase tracking-wider" style={{ background: c.conta ? "rgba(201,174,122,.15)" : "rgba(255,255,255,.06)", color: c.conta ? COLOR.gold : COLOR.mute }}>
                        {c.conta ? "conta p/ vendedor" : "grupo"}
                      </span>
                    </td>
                    <td data-label="Realizado" className="py-2 pr-3 text-right tabular-nums text-white/70">
                      {BRL(c.realizado)}
                      <span className="block text-[11px] text-white/35">{INT(c.qtd)} un.</span>
                    </td>
                    <td data-label="Meta (R$)" className="py-2 pl-2"><NumberField className="input !py-1.5 text-right tabular-nums" step="0.01" min={0} value={e.valor} onChange={(v) => mudarLinha(c.id, "valor", v)} /></td>
                    <td data-label="Meta (qtd)" className="py-2 pl-2"><NumberField className="input !py-1.5 text-right tabular-nums" min={0} value={e.qtd} onChange={(v) => mudarLinha(c.id, "qtd", v)} /></td>
                    <td data-label="% da meta" className="py-2 pl-2 text-right font-semibold tabular-nums" style={{ color: !tem ? COLOR.mute : pct >= 100 ? COLOR.ok : COLOR.neutral }}>{tem ? PCT(pct) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3 · META POR VENDEDOR */}
      <section className={secao}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {titulo(3, "Meta por vendedor", "A meta individual de cada vendedor da BU — é ela que define comissão e o placar de cada um. A soma deve fechar com a meta total (seção 1).")}
          <div className="flex items-center gap-3">
            {metaPrincipal > 0 && <StatusBadge ok={Math.abs(diff) <= 0.5} diff={diff} isQtd={isQtd} />}
            <button className="btn-ghost !py-1.5 text-xs" onClick={distribuirIgual} disabled={metaPrincipal === 0 || buSellers.length === 0}>
              <SplitSquareHorizontal className="h-4 w-4" /> Distribuir igualmente
            </button>
          </div>
        </div>
        {buSellers.length === 0 ? (
          <div className="py-2 text-sm text-white/60">
            Nenhum vendedor nesta BU. Cadastre em <a href="/admin/sellers" className="text-accent">Vendedores</a> e marque a BU {BU_LABEL[bu]}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-stack w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--hair)] font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
                  <th className="py-2 text-left font-semibold">Vendedor</th>
                  <th className="py-2 text-right font-semibold">Faturamento (R$)</th>
                  {showQtdCol && <th className="py-2 text-right font-semibold">Matrículas (qtd)</th>}
                  <th className="py-2 text-right font-semibold">Ticket meta (R$)</th>
                  <th className="py-2 text-right font-semibold">Conversão meta (%)</th>
                  <th className="py-2 text-right font-semibold">% da BU</th>
                </tr>
              </thead>
              <tbody>
                {buSellers.map((s) => {
                  const g = goals[s.id] || vazioMeta(s.id);
                  const principal = isQtd ? g.quantidade_meta : g.valor_meta;
                  return (
                    <tr key={s.id} className="border-t border-[var(--hair)]">
                      <td data-label="Vendedor" className="py-2 pr-3 font-medium">{s.name}</td>
                      <td data-label="Faturamento (R$)" className="py-2 pl-2"><NumberField step="0.01" className="input !py-1.5 text-right" value={g.valor_meta} onChange={(v) => mudarVend(s.id, { valor_meta: v })} /></td>
                      {showQtdCol && <td data-label="Matrículas (qtd)" className="py-2 pl-2"><NumberField className="input !py-1.5 text-right" value={g.quantidade_meta} onChange={(v) => mudarVend(s.id, { quantidade_meta: v })} /></td>}
                      <td data-label="Ticket meta (R$)" className="py-2 pl-2"><NumberField step="0.01" className="input !py-1.5 text-right" value={g.ticket_medio_meta} onChange={(v) => mudarVend(s.id, { ticket_medio_meta: v })} /></td>
                      <td data-label="Conversão meta (%)" className="py-2 pl-2"><NumberField step="0.1" className="input !py-1.5 text-right" value={g.taxa_conversao_meta} onChange={(v) => mudarVend(s.id, { taxa_conversao_meta: v })} /></td>
                      <td data-label="% da BU" className="py-2 pl-2 text-right text-xs font-semibold" style={{ color }}>{metaPrincipal > 0 ? PCT((principal / metaPrincipal) * 100) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ ok, diff, isQtd }: { ok: boolean; diff: number; isQtd: boolean }) {
  if (ok) {
    return (
      <div className="flex items-center gap-1 text-[11px]" style={{ color: COLOR.ok }}>
        <CheckCircle2 className="h-3.5 w-3.5" /> bate com a meta total
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-[11px]" style={{ color: COLOR.warning }}>
      <AlertTriangle className="h-3.5 w-3.5" />
      {diff > 0 ? "acima" : "abaixo"} da meta total em {isQtd ? `${INT(Math.abs(diff))} un.` : BRL(Math.abs(diff))}
    </div>
  );
}
