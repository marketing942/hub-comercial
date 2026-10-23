"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power, Trash2, Search, Key, X, Check, RotateCw } from "lucide-react";
import { BU_LABEL } from "@/lib/brand";
import { ALL_BUS, type BU } from "@/lib/products";

type Seller = {
  id: string;
  name: string;
  bu: BU;
  bus?: BU[];
  active: boolean;
  avatar_color: string;
  has_password?: boolean;
};

function busOf(s: Seller): BU[] {
  const arr = Array.isArray(s.bus)
    ? s.bus.filter((x) => x === "cppem" || x === "unicive" || x === "colegio_cppem")
    : [];
  return arr.length > 0 ? Array.from(new Set(arr)) : [s.bu];
}

type StatusFilter = "all" | "active" | "inactive";
type BuFilter = "all" | BU;

export default function SellersClient({ initial }: { initial: Seller[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [bus, setBus] = useState<BU[]>(["cppem"]);
  const [busy, setBusy] = useState(false);

  // Filtros da tabela
  const [search, setSearch] = useState("");
  const [buFilter, setBuFilter] = useState<BuFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Modal de senha
  const [pwTarget, setPwTarget] = useState<Seller | null>(null);

  function toggleBu(b: BU) {
    setBus((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  }

  async function add() {
    if (!name.trim() || bus.length === 0) return;
    setBusy(true);
    const r = await fetch("/api/sellers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), bus, bu: bus[0] }),
    });
    setBusy(false);
    if (r.ok) {
      const { data } = await r.json();
      setList((l) => [...l, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      router.refresh();
    }
  }

  async function toggle(s: Seller) {
    await fetch(`/api/sellers/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    setList((l) => l.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
    router.refresh();
  }

  async function rename(s: Seller, newName: string) {
    await fetch(`/api/sellers/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setList((l) => l.map((x) => (x.id === s.id ? { ...x, name: newName } : x)));
    router.refresh();
  }

  async function changeBUs(s: Seller, newBus: BU[]) {
    if (newBus.length === 0) return;
    await fetch(`/api/sellers/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bus: newBus }),
    });
    setList((l) => l.map((x) => (x.id === s.id ? { ...x, bus: newBus, bu: newBus[0] } : x)));
    router.refresh();
  }

  async function remove(s: Seller) {
    if (!confirm(`Remover ${s.name}? Vendas e metas serao apagadas.`)) return;
    await fetch(`/api/sellers/${s.id}`, { method: "DELETE" });
    setList((l) => l.filter((x) => x.id !== s.id));
    router.refresh();
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list
      .filter((s) => (statusFilter === "all" ? true : statusFilter === "active" ? s.active : !s.active))
      .filter((s) => (buFilter === "all" ? true : busOf(s).includes(buFilter)))
      .filter((s) => (term ? s.name.toLowerCase().includes(term) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [list, search, buFilter, statusFilter]);

  const counters = useMemo(() => {
    const active = list.filter((s) => s.active).length;
    return { total: list.length, active, inactive: list.length - active };
  }, [list]);

  return (
    <div className="space-y-4">
      {/* Form de adicionar */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="label">Nome do vendedor</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Joana Silva"
            />
          </div>
          <div>
            <label className="label">BU(s)</label>
            <div className="flex gap-2 flex-wrap">
              {ALL_BUS.map((b) => {
                const active = bus.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBu(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      active
                        ? "bg-accent text-black border-accent"
                        : "bg-panel2 text-white/60 border-border hover:text-white"
                    }`}
                  >
                    {BU_LABEL[b]}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={add}
            disabled={busy || !name.trim() || bus.length === 0}
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* Filtros + contagens */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <div>
            <label className="label">Buscar por nome</label>
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className="input pl-9"
                placeholder="Digite o nome do vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">BU</label>
            <select
              className="input h-10"
              value={buFilter}
              onChange={(e) => setBuFilter(e.target.value as BuFilter)}
            >
              <option value="all">Todas</option>
              {ALL_BUS.map((b) => (
                <option key={b} value={b}>{BU_LABEL[b]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input h-10"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="text-[11px] text-white/60 leading-tight pb-2">
            Total: <b className="text-white">{counters.total}</b>
            <span className="text-white/40"> · </span>
            <span className="text-success">{counters.active} ativos</span>
            <span className="text-white/40"> · </span>
            <span className="text-white/50">{counters.inactive} inativos</span>
          </div>
        </div>
      </div>

      {/* Tabela unica */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-stack w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-panel2/60">
              <tr className="text-left">
                <th className="p-3">Nome</th>
                <th className="p-3">Atua em</th>
                <th className="p-3">Status</th>
                <th className="p-3">Senha</th>
                <th className="p-3 text-right w-36">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-white/40 text-xs">
                    Nenhum vendedor encontrado com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const sBus = busOf(s);
                return (
                  <tr key={s.id} className="border-t border-border hover:bg-panel2/30">
                    <td data-label="Nome" className="p-3">
                      <input
                        defaultValue={s.name}
                        onBlur={(e) =>
                          e.target.value.trim() &&
                          e.target.value !== s.name &&
                          rename(s, e.target.value.trim())
                        }
                        className="bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none font-medium w-full max-w-[260px]"
                      />
                    </td>
                    <td data-label="Atua em" className="p-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {ALL_BUS.map((b) => {
                          const active = sBus.includes(b);
                          return (
                            <button
                              key={b}
                              onClick={() => {
                                const next = active
                                  ? sBus.filter((x) => x !== b)
                                  : [...sBus, b];
                                if (next.length === 0) return;
                                changeBUs(s, next);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                                active
                                  ? b === "cppem"
                                    ? "bg-cppem/20 text-cppem border-cppem/40"
                                    : b === "unicive"
                                    ? "bg-unicive/20 text-unicive border-unicive/40"
                                    : "bg-colegio/20 text-colegio border-colegio/40"
                                  : "bg-panel2 text-white/40 border-border"
                              }`}
                            >
                              {BU_LABEL[b]}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td data-label="Status" className="p-3">
                      <span
                        className={`chip ${
                          s.active
                            ? "bg-success/15 text-success"
                            : "bg-white/10 text-white/50"
                        }`}
                      >
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td data-label="Senha" className="p-3">
                      {s.has_password ? (
                        <span className="chip bg-success/15 text-success">Definida</span>
                      ) : (
                        <span className="chip bg-warning/15 text-warning">Nao definida</span>
                      )}
                    </td>
                    <td data-label="" className="p-3 text-right">
                      <button
                        className="btn-ghost h-8 px-2 mr-1"
                        onClick={() => setPwTarget(s)}
                        title="Definir / redefinir senha"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-ghost h-8 px-2 mr-1"
                        onClick={() => toggle(s)}
                        title={s.active ? "Inativar" : "Ativar"}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-danger h-8 px-2"
                        onClick={() => remove(s)}
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal de senha */}
      <PasswordModal
        target={pwTarget}
        onClose={() => setPwTarget(null)}
        onDone={(id) => {
          setList((l) => l.map((x) => (x.id === id ? { ...x, has_password: true } : x)));
          router.refresh();
        }}
      />
    </div>
  );
}

function PasswordModal({
  target,
  onClose,
  onDone,
}: {
  target: Seller | null;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!target) return null;

  async function save() {
    setErr(null);
    if (!target) return;
    if (pw.length < 4) {
      setErr("Senha precisa ter no minimo 4 caracteres.");
      return;
    }
    if (pw !== pw2) {
      setErr("As senhas nao coincidem.");
      return;
    }
    setSaving(true);
    const r = await fetch(`/api/sellers/${target.id}/password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setSaving(false);
    if (r.ok) {
      onDone(target.id);
      setPw("");
      setPw2("");
      onClose();
    } else {
      const j = await r.json().catch(() => ({}));
      setErr(j.error || "Erro ao salvar.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-3 sm:p-6"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-panel border border-border rounded-2xl shadow-glow w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="text-sm font-semibold">
              {target.has_password ? "Redefinir senha" : "Definir senha"}
            </div>
            <div className="text-[11px] text-white/50">
              Vendedor: <b className="text-white/80">{target.name}</b>
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
        <div className="p-4 space-y-3">
          <div>
            <label className="label">Nova senha</label>
            <input
              type="password"
              className="input"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              placeholder="Mínimo 4 caracteres"
            />
          </div>
          <div>
            <label className="label">Confirmar senha</label>
            <input
              type="password"
              className="input"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Digite novamente"
            />
          </div>
          <div className="text-[11px] text-white/50 leading-snug">
            O vendedor usara essa chave para entrar no sistema. Ele pode trocar a propria senha depois no painel dele.
          </div>
          {err && <div className="text-xs text-danger">{err}</div>}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button className="btn-ghost h-9 text-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn-primary h-9 text-sm"
            onClick={save}
            disabled={saving || !pw || !pw2}
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
