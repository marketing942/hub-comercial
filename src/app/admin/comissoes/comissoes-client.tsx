"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRL, fmtPct } from "@/lib/calc";
import { BU_COLOR, BU_LABEL, COLOR } from "@/lib/brand";
import { ALL_BUS, type BU } from "@/lib/products";
import type { CommissionRules, CommissionTier } from "@/lib/commission";
import NumberField from "@/components/NumberField";
import { Plus, Trash2, Save, RotateCw, Award, Sparkles } from "lucide-react";

type BoardRow = {
  sellerId: string;
  sellerName: string;
  realizado: number;
  meta: number;
  pctMeta: number;
  tierPct: number | null;
  commissionPct: number;
  commissionValue: number;
  podium: number | null;
  bonus: number;
  total: number;
};

type Board = {
  rows: BoardRow[];
  bu: BU;
  sumMeta: number;
  sumRealizado: number;
  pctColetivo: number;
  unlocked: boolean;
  unlockedAt: number;
  totalComissao: number;
  totalBonus: number;
  totalPayout: number;
};

export default function ComissoesClient({
  rules,
  boards,
}: {
  rules: Record<BU, CommissionRules>;
  boards: Record<BU, Board>;
}) {
  const [tab, setTab] = useState<BU>("cppem");

  return (
    <div className="space-y-4">
      <div className="inline-flex p-1 rounded-xl bg-panel border border-border">
        {ALL_BUS.map((b) => (
          <button
            key={b}
            onClick={() => setTab(b)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === b ? "bg-accent text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {BU_LABEL[b]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
        {/* key={tab} forca remount ao trocar de BU pra o useState
            reinicializar com o initial certo (senao React reusa a
            instancia e o form fica com o estado da BU anterior) */}
        <RulesEditor key={tab} bu={tab} initial={rules[tab]} />
        <BoardView key={`board-${tab}`} board={boards[tab]} />
      </div>
    </div>
  );
}

function RulesEditor({ bu, initial }: { bu: BU; initial: CommissionRules }) {
  const router = useRouter();
  const [minPct, setMinPct] = useState(initial.min_meta_pct);
  const [cumulative, setCumulative] = useState(initial.cumulative);
  const [extra, setExtra] = useState(initial.bu_bonus_extra_pct);
  const [top1, setTop1] = useState(initial.top1_bonus);
  const [top2, setTop2] = useState(initial.top2_bonus);
  const [top3, setTop3] = useState(initial.top3_bonus);
  const [notes, setNotes] = useState(initial.notes || "");
  const [tiers, setTiers] = useState<CommissionTier[]>(
    initial.tiers.map((t) => ({ meta_pct: t.meta_pct, commission_pct: t.commission_pct }))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const color = BU_COLOR[bu];

  function updateTier(idx: number, patch: Partial<CommissionTier>) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function addTier() {
    const nextPct = tiers.length > 0 ? Math.max(...tiers.map((t) => t.meta_pct)) + 10 : 80;
    setTiers((prev) => [...prev, { meta_pct: nextPct, commission_pct: 0 }].sort((a, b) => a.meta_pct - b.meta_pct));
  }
  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const cleaned = [...tiers]
      .filter((t) => Number.isFinite(t.meta_pct) && Number.isFinite(t.commission_pct))
      .sort((a, b) => a.meta_pct - b.meta_pct);
    const r = await fetch("/api/commission-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bu,
        min_meta_pct: minPct,
        cumulative,
        bu_bonus_extra_pct: extra,
        top1_bonus: top1,
        top2_bonus: top2,
        top3_bonus: top3,
        notes,
        tiers: cleaned,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Regras salvas. Painel dos vendedores ja reflete." });
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setMsg({ kind: "err", text: j.error || "Erro ao salvar" });
    }
  }

  return (
    <div className="card-lg space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4" style={{ color }} />
        <div className="text-sm font-semibold">Regras de comissao — {BU_LABEL[bu]}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Comissao a partir de (%)</label>
          <NumberField className="input" step="0.5" value={minPct} onChange={setMinPct} />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 select-none cursor-pointer mt-6">
            <input
              type="checkbox"
              checked={cumulative}
              onChange={(e) => setCumulative(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Comissao acumulativa entre tiers</span>
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-white/50">Tiers (% meta -&gt; % comissao)</div>
          <button className="btn-ghost h-7 px-2 text-xs" onClick={addTier}>
            <Plus className="w-3 h-3" /> Novo tier
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-panel2">
              <tr className="text-left">
                <th className="p-2">% Meta</th>
                <th className="p-2">% Comissao</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <NumberField
                      step="0.5"
                      className="input h-8 text-sm"
                      value={t.meta_pct}
                      onChange={(v) => updateTier(i, { meta_pct: v })}
                    />
                  </td>
                  <td className="p-1.5">
                    <NumberField
                      step="0.1"
                      className="input h-8 text-sm"
                      value={t.commission_pct}
                      onChange={(v) => updateTier(i, { commission_pct: v })}
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <button className="btn-danger h-8 px-2" onClick={() => removeTier(i)}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-white/50 text-xs">
                    Nenhum tier. Adicione ao menos um.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="text-xs uppercase tracking-wider text-white/50 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Bonus de podio (coletivo)
        </div>
        <div>
          <label className="label">Destrava com a coletiva a partir de (+% acima de 100)</label>
          <NumberField className="input" step="0.5" value={extra} onChange={setExtra} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Top 1 (R$)</label>
            <NumberField className="input" step="10" value={top1} onChange={setTop1} />
          </div>
          <div>
            <label className="label">Top 2 (R$)</label>
            <NumberField className="input" step="10" value={top2} onChange={setTop2} />
          </div>
          <div>
            <label className="label">Top 3 (R$)</label>
            <NumberField className="input" step="10" value={top3} onChange={setTop3} />
          </div>
        </div>
      </div>

      <div>
        <label className="label">Observacoes (aparece pro vendedor)</label>
        <input
          type="text"
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Ex: Comissao paga no dia 5 do mes seguinte."
        />
      </div>

      <div className="flex items-center justify-between">
        {msg ? (
          <div className={`text-xs ${msg.kind === "ok" ? "text-success" : "text-danger"}`}>
            {msg.text}
          </div>
        ) : <div />}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar regras"}
        </button>
      </div>
    </div>
  );
}

function BoardView({ board }: { board: Board }) {
  const color = BU_COLOR[board.bu];
  return (
    <div className="card-lg p-0 overflow-hidden">
      {/* Resumo coletivo */}
      <div className="p-4 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Coletiva</div>
          <div className="text-lg font-bold" style={{ color: board.unlocked ? COLOR.ok : color }}>
            {fmtPct(board.pctColetivo)}
          </div>
          <div className="text-[11px] text-white/50">
            {BRL.format(board.sumRealizado)} / {BRL.format(board.sumMeta)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            Bonus podio {board.unlocked ? "destravado" : `destrava aos ${board.unlockedAt.toFixed(0)}%`}
          </div>
          <div className="text-lg font-bold" style={{ color: board.unlocked ? COLOR.ok : "#ada99b" }}>
            {board.unlocked ? "SIM" : "Nao ainda"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Total comissao</div>
          <div className="text-lg font-bold">{BRL.format(board.totalComissao)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Total a pagar (com bonus)</div>
          <div className="text-lg font-bold" style={{ color: COLOR.ok }}>
            {BRL.format(board.totalPayout)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table-stack w-full text-sm min-w-[900px]">
          <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-panel2/60">
            <tr className="text-left">
              <th className="py-2 pl-4">Vendedor</th>
              <th className="text-right">Realizado</th>
              <th className="text-right">Meta</th>
              <th className="text-right">% Meta</th>
              <th className="text-right">Tier</th>
              <th className="text-right">% Comm</th>
              <th className="text-right">Comissao</th>
              <th className="text-right">Podio</th>
              <th className="text-right pr-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-white/50">
                  Nenhum vendedor ativo nesta BU.
                </td>
              </tr>
            ) : board.rows.map((r) => {
              const podiumMedal = r.podium === 1 ? "🥇" : r.podium === 2 ? "🥈" : r.podium === 3 ? "🥉" : "";
              return (
                <tr key={r.sellerId} className="border-t border-border hover:bg-panel2/30">
                  <td data-label="Vendedor" className="py-2 pl-4 font-medium">{r.sellerName}</td>
                  <td data-label="Realizado" className="text-right whitespace-nowrap">{BRL.format(r.realizado)}</td>
                  <td data-label="Meta" className="text-right text-white/60 whitespace-nowrap">{BRL.format(r.meta)}</td>
                  <td data-label="% Meta" className="text-right font-semibold whitespace-nowrap" style={{ color: r.pctMeta >= 100 ? COLOR.ok : color }}>
                    {fmtPct(r.pctMeta)}
                  </td>
                  <td data-label="Tier" className="text-right whitespace-nowrap">
                    {r.tierPct ? (
                      <span className="chip" style={{ background: color + "22", color }}>{r.tierPct}%</span>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    )}
                  </td>
                  <td data-label="% Comm" className="text-right whitespace-nowrap">
                    {r.commissionPct > 0 ? `${r.commissionPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—"}
                  </td>
                  <td data-label="Comissao" className="text-right font-semibold whitespace-nowrap" style={{ color: r.commissionValue > 0 ? color : "#64748b" }}>
                    {BRL.format(r.commissionValue)}
                  </td>
                  <td data-label="Podio" className="text-right whitespace-nowrap">
                    {r.podium ? (
                      <span className="inline-flex items-center gap-1">
                        <span>{podiumMedal}</span>
                        {r.bonus > 0 ? (
                          <span className="font-semibold" style={{ color: COLOR.ok }}>{BRL.format(r.bonus)}</span>
                        ) : (
                          <span className="text-white/50 text-xs">travado</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </td>
                  <td data-label="Total" className="text-right pr-4 font-bold whitespace-nowrap" style={{ color: r.total > 0 ? COLOR.ok : "#64748b" }}>
                    {BRL.format(r.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
