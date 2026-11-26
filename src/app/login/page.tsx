"use client";
import { useState } from "react";
import { Trophy, Key } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Chave invalida.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    // Navegacao completa (nao router.push): limpa o Router Cache do Next, senao a
    // barra do topo da conta anterior (ex.: admin) fica guardada e reaparece.
    window.location.assign(j.role === "admin" ? "/dashboard" : "/seller");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/20 grid place-items-center">
            <Trophy className="w-5 h-5 text-accent" />
          </div>
          <div>
            <div className="text-lg font-semibold">Hub de Receita</div>
            <div className="text-xs text-white/50">Gestão</div>
          </div>
        </div>

        <div className="card">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label flex items-center gap-1">
                <Key className="w-3 h-3" /> Chave de acesso
              </label>
              <input
                className="input"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua chave de acesso"
              />
            </div>
            {err && <div className="text-sm text-danger">{err}</div>}
            <button className="btn-primary w-full" disabled={loading || !password}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-xs text-white/40 mt-4">
            O sistema identifica o seu acesso pela chave. Esqueceu? Fale com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
