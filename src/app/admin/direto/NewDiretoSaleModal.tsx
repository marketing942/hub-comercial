"use client";
import { useEffect, useState } from "react";
import { X, Check, ArrowLeft, ArrowRight, RotateCw, Globe, Bot, Calendar, Package, Wallet } from "lucide-react";
import NumberField from "@/components/NumberField";
import {
  PRODUCT_LINES_CPPEM,
  PRODUCT_LINES_UNICIVE,
  type BU,
} from "@/lib/products";

export type Channel = "direto" | "ia";

export type DiretoSale = {
  id: string;
  sale_date: string;
  product_line: string;
  valor: number;
  quantidade: number;
  observacao?: string | null;
  channel?: Channel | null;
};

const STEP_LABELS = ["Canal", "Produto", "Valores"];

function linesFor(channel: Channel, bu: BU): { id: string; label: string }[] {
  if (channel === "direto") return PRODUCT_LINES_CPPEM.map((l) => ({ id: l.id, label: l.label }));
  if (bu === "unicive") return PRODUCT_LINES_UNICIVE.map((l) => ({ id: l.id, label: l.label }));
  return PRODUCT_LINES_CPPEM.map((l) => ({ id: l.id, label: l.label }));
}

export default function NewDiretoSaleModal({
  open,
  onClose,
  onCreated,
  todayISO,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (sale: DiretoSale) => void;
  todayISO: string;
}) {
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>("direto");
  const [buForIA, setBuForIA] = useState<BU>("cppem");
  const [date, setDate] = useState(todayISO);
  const [line, setLine] = useState<string>(PRODUCT_LINES_CPPEM[0]?.id || "");
  const [valor, setValor] = useState(0);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setChannel("direto");
      setBuForIA("cppem");
      setDate(todayISO);
      setLine(PRODUCT_LINES_CPPEM[0]?.id || "");
      setValor(0);
      setQtd(1);
      setObs("");
      setErr(null);
      setSaving(false);
    }
  }, [open, todayISO]);

  // Ao mudar canal/BU garante que a linha selecionada e valida
  useEffect(() => {
    const opts = linesFor(channel, buForIA);
    if (!opts.some((o) => o.id === line)) setLine(opts[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, buForIA]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, saving, onClose]);

  if (!open) return null;

  const canStep0 = true;
  const canStep1 = !!date && !!line;
  const canStep2 = valor > 0 && qtd >= 1;
  const canSubmit = canStep0 && canStep1 && canStep2;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    const r = await fetch("/api/direct/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sale_date: date,
        product_line: line,
        valor,
        quantidade: qtd,
        observacao: obs || null,
        channel,
      }),
    });
    setSaving(false);
    if (r.ok) {
      const { data } = await r.json();
      onCreated(data as DiretoSale);
      onClose();
    } else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error || "Erro ao salvar venda.");
    }
  }

  const opts = linesFor(channel, buForIA);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-3 sm:p-6"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-panel border border-border rounded-2xl shadow-glow w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Nova venda (Direto / IA)</div>
            <div className="text-[11px] text-white/50">
              Passo {step + 1} de 3 · {STEP_LABELS[step]}
            </div>
          </div>
          <button
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-panel2 text-white/60 hover:text-white"
            onClick={onClose}
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-1">
            {STEP_LABELS.map((lbl, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <div key={lbl} className="flex items-center gap-1 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                      done ? "bg-success text-black" : current ? "bg-accent text-black" : "bg-panel2 text-white/40"
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <div className={`text-[10px] font-semibold truncate ${current ? "text-white" : done ? "text-white/70" : "text-white/40"}`}>
                    {lbl}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`h-px flex-1 ${done ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className="label">Canal da venda</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel("direto")}
                    className={`text-left rounded-xl border p-3 transition ${
                      channel === "direto" ? "border-accent bg-accent/10" : "border-border bg-panel2 hover:border-accent/40"
                    }`}
                  >
                    <div className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#74aee0" }}>
                      <Globe className="w-3.5 h-3.5" /> Direto (site)
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5 leading-snug">
                      Venda feita pelo site. So aceita categorias CPPEM.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("ia")}
                    className={`text-left rounded-xl border p-3 transition ${
                      channel === "ia" ? "border-accent bg-accent/10" : "border-border bg-panel2 hover:border-accent/40"
                    }`}
                  >
                    <div className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#b99be0" }}>
                      <Bot className="w-3.5 h-3.5" /> IA (atendimento)
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5 leading-snug">
                      Fechada por IA. CPPEM ou UNICIVE.
                    </div>
                  </button>
                </div>
              </div>

              {channel === "ia" && (
                <div>
                  <label className="label">BU da venda</label>
                  <div className="inline-flex p-1 rounded-xl bg-panel2 border border-border">
                    {(["cppem", "unicive"] as BU[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBuForIA(b)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          buForIA === b ? "bg-accent text-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {b === "cppem" ? "CPPEM" : "UNICIVE"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="label flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Data da venda
                </label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  max={todayISO}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  <Package className="w-3 h-3" /> Categoria ({channel === "direto" ? "CPPEM" : buForIA === "unicive" ? "UNICIVE" : "CPPEM"})
                </label>
                <select className="input" value={line} onChange={(e) => setLine(e.target.value)}>
                  {opts.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="label flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Valor (R$)
                </label>
                <NumberField step="0.01" className="input text-xl font-bold" value={valor} onChange={setValor} />
              </div>
              <div>
                <label className="label">Quantidade</label>
                <NumberField min={1} className="input text-xl font-bold" value={qtd} onChange={setQtd} />
              </div>
              <div>
                <label className="label">
                  Observacao <span className="text-white/40 normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: campanha X, cupom Y, nome do agente IA..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>
            </>
          )}

          {err && <div className="text-xs text-danger">{err}</div>}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2 bg-panel/80">
          <button
            className="btn-ghost h-9 text-sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          {step < 2 ? (
            <button
              className="btn-primary h-9 text-sm"
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              disabled={(step === 0 && !canStep0) || (step === 1 && !canStep1)}
            >
              Avancar <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              className="btn-primary h-9 text-sm"
              onClick={submit}
              disabled={!canSubmit || saving}
            >
              {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Salvando..." : "Lancar venda"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
