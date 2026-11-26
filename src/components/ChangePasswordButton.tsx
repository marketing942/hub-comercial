"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, X, Check, RotateCw } from "lucide-react";

export default function ChangePasswordButton({
  sellerName,
  hasPassword,
}: {
  sellerName: string;
  hasPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (n1.length < 4) {
      setMsg({ kind: "err", text: "Senha precisa ter no minimo 4 caracteres." });
      return;
    }
    if (n1 !== n2) {
      setMsg({ kind: "err", text: "As senhas nao coincidem." });
      return;
    }
    setSaving(true);
    const r = await fetch("/api/seller/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: hasPassword ? cur : undefined,
        newPassword: n1,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Senha atualizada com sucesso." });
      setCur("");
      setN1("");
      setN2("");
      setTimeout(() => {
        setOpen(false);
        setMsg(null);
      }, 1200);
    } else {
      const j = await r.json().catch(() => ({}));
      setMsg({ kind: "err", text: j.error || "Erro ao salvar." });
    }
  }

  return (
    <>
      <button
        className="btn-ghost !py-1.5 !px-3 text-xs max-sm:!px-2.5"
        onClick={() => setOpen(true)}
        title={hasPassword ? "Mudar minha senha" : "Definir minha senha"}
      >
        <KeyRound className="w-3.5 h-3.5" />
        <span className="max-sm:hidden">Senha</span>
      </button>

      {/* Portal no body: o botao fica na barra do topo, que tem backdrop-blur
          (vira o "containing block" de fixed) e prenderia o modal nela. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-3 sm:p-6"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-md shadow-glow w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <div className="text-sm font-semibold">
                  {hasPassword ? "Mudar minha senha" : "Definir minha senha"}
                </div>
                <div className="text-[11px] text-white/50">
                  {sellerName}
                </div>
              </div>
              <button
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-panel2 text-white/60 hover:text-white"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {hasPassword && (
                <div>
                  <label className="label">Senha atual</label>
                  <input
                    type="password"
                    className="input"
                    value={cur}
                    onChange={(e) => setCur(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <div>
                <label className="label">Nova senha</label>
                <input
                  type="password"
                  className="input"
                  value={n1}
                  onChange={(e) => setN1(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  autoFocus={!hasPassword}
                />
              </div>
              <div>
                <label className="label">Confirmar nova senha</label>
                <input
                  type="password"
                  className="input"
                  value={n2}
                  onChange={(e) => setN2(e.target.value)}
                />
              </div>
              <div className="text-[11px] text-white/50 leading-snug">
                A nova chave e usada pra entrar no sistema. O administrador consegue
                redefinir caso voce esqueca.
              </div>
              {msg && (
                <div className={`text-xs ${msg.kind === "ok" ? "text-success" : "text-danger"}`}>
                  {msg.text}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                className="btn-ghost h-9 text-sm"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="btn-primary h-9 text-sm"
                onClick={save}
                disabled={saving || !n1 || !n2 || (hasPassword && !cur)}
              >
                {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
