"use client";
/**
 * Vendedores (Configuracoes): uma tabela so, vinda do Conta Azul. Cada mudanca
 * salva na hora e a pagina rele o banco (`router.refresh`). Nao existe criar nem
 * excluir: o cadastro e do Conta Azul.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, Search, Key, X, Check, RotateCw } from "lucide-react";
import { BU_LABEL, COLOR } from "@/lib/brand";
import { ALL_BUS, type BU } from "@/lib/products";

type Destino = "vendedor" | "canal_direto" | "grupo" | "pendente";

export type Pessoa = {
  chave: string;
  nome: string;
  /** Nomes dos cadastros no Conta Azul (mais de um = duplicado la). */
  cadastros: string[];
  caIds: string[];
  destino: Destino;
  vendas: number;
  valor: number;
  /** Vendedor do Hub ligado (guardado mesmo quando o destino deixa de ser vendedor). */
  hub: { id: string; bus: BU[]; active: boolean; temSenha: boolean } | null;
};

const ROTULO: Record<Destino, string> = { vendedor: "Vendedor", canal_direto: "Canal direto", grupo: "Grupo", pendente: "Pendente" };
const ORDEM: Record<Destino, number> = { pendente: 0, vendedor: 1, canal_direto: 2, grupo: 3 };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const corBu = (b: BU) =>
  b === "cppem" ? "bg-cppem/20 text-cppem border-cppem/40" : b === "unicive" ? "bg-unicive/20 text-unicive border-unicive/40" : "bg-colegio/20 text-colegio border-colegio/40";

export default function SellersClient({ pessoas }: { pessoas: Pessoa[] }) {
  const router = useRouter();
  const [atualizando, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  // Linha marcada como "Vendedor" que ainda nao tem BU: so grava quando a BU for escolhida.
  const [querVendedor, setQuerVendedor] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");
  const [destinoF, setDestinoF] = useState<"todos" | Destino>("todos");
  const [buF, setBuF] = useState<"all" | BU>("all");
  const [statusF, setStatusF] = useState<"all" | "active" | "inactive">("all");
  const [senhaDe, setSenhaDe] = useState<{ id: string; name: string; has_password: boolean } | null>(null);

  // Voltando pela navegacao o Next pode reaproveitar a pagina antiga: rele.
  useEffect(() => router.refresh(), [router]);

  async function enviar(chave: string, url: string, method: string, body: unknown) {
    setOcupado(chave);
    setErro((e) => ({ ...e, [chave]: "" }));
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      setErro((e) => ({ ...e, [chave]: j?.error || "Nao foi possivel salvar." }));
    }
    setOcupado(null);
    startTransition(() => router.refresh());
    return Boolean(r?.ok);
  }

  const destino = (p: Pessoa, d: Destino, extra?: { bus?: BU[]; seller_id?: string }) =>
    enviar(p.chave, "/api/ca/vendedores", "POST", { ca_vendedor_ids: p.caIds, destino: d, ...extra });

  function mudarDestino(p: Pessoa, d: Destino) {
    setQuerVendedor((q) => ({ ...q, [p.chave]: d === "vendedor" && !p.hub }));
    // Sem vendedor no Hub ainda: espera a BU (ou a pessoa ja existente) para gravar.
    if (d === "vendedor" && !p.hub) return;
    void destino(p, d);
  }

  function alternarBu(p: Pessoa, b: BU) {
    if (!p.hub) return void destino(p, "vendedor", { bus: [b] });
    const tem = p.hub.bus.includes(b);
    const nova = tem ? p.hub.bus.filter((x) => x !== b) : [...p.hub.bus, b];
    if (nova.length === 0) return;
    void enviar(p.chave, `/api/sellers/${p.hub.id}`, "PATCH", { bus: nova });
  }

  const existentes = useMemo(() => pessoas.filter((p) => p.hub).map((p) => ({ id: p.hub!.id, nome: p.nome })).sort((a, b) => a.nome.localeCompare(b.nome)), [pessoas]);

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pessoas
      .filter((p) => destinoF === "todos" || p.destino === destinoF)
      .filter((p) => buF === "all" || (p.destino === "vendedor" && p.hub?.bus.includes(buF)))
      .filter((p) => statusF === "all" || (p.destino === "vendedor" && !!p.hub && p.hub.active === (statusF === "active")))
      .filter((p) => !t || [p.nome, ...p.cadastros].some((n) => n.toLowerCase().includes(t)))
      .sort(
        (a, b) =>
          ORDEM[a.destino] - ORDEM[b.destino] ||
          Number(b.hub?.active ?? false) - Number(a.hub?.active ?? false) ||
          a.nome.localeCompare(b.nome, "pt-BR")
      );
  }, [pessoas, busca, destinoF, buF, statusF]);

  const vendedores = pessoas.filter((p) => p.destino === "vendedor" && p.hub);
  const ativos = vendedores.filter((p) => p.hub!.active).length;
  const pendentes = pessoas.filter((p) => p.destino === "pendente").length;

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <div>
            <label className="label">Buscar por nome</label>
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input className="input pl-9" placeholder="Digite o nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Destino</label>
            <select className="input h-10" value={destinoF} onChange={(e) => setDestinoF(e.target.value as typeof destinoF)}>
              <option value="todos">Todos</option>
              {(Object.keys(ROTULO) as Destino[]).map((d) => (
                <option key={d} value={d}>{ROTULO[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">BU</label>
            <select className="input h-10" value={buF} onChange={(e) => setBuF(e.target.value as typeof buF)}>
              <option value="all">Todas</option>
              {ALL_BUS.map((b) => (
                <option key={b} value={b}>{BU_LABEL[b]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input h-10" value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-white/55">
          {pessoas.length} no Conta Azul · <span className="text-success">{ativos} vendedores ativos</span> · {vendedores.length - ativos} inativos
          {pendentes > 0 && <span className="text-warning"> · {pendentes} pendente{pendentes > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-stack w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-white/40">
              <tr className="text-left">
                <th className="p-3">Nome no Conta Azul</th>
                <th className="p-3 text-right">Movimentou</th>
                <th className="p-3 w-44">Destino</th>
                <th className="p-3">BU</th>
                <th className="p-3">Status</th>
                <th className="p-3">Senha</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-white/40 text-xs">
                    {pessoas.length === 0 ? "Nenhum vendedor recebido do Conta Azul ainda." : "Ninguem encontrado com esses filtros."}
                  </td>
                </tr>
              )}
              {linhas.map((p) => {
                const aguardando = !!querVendedor[p.chave] && !p.hub;
                const eVendedor = p.destino === "vendedor" || aguardando;
                const trabalhando = ocupado === p.chave;
                return (
                  <tr key={p.chave} className="border-t border-[var(--hair)] align-top">
                    <td data-label="Nome" className="p-3">
                      <div className={eVendedor || p.destino === "pendente" ? "font-medium" : "text-white/60"}>{p.nome}</div>
                      {p.cadastros.length > 1 && <div className="text-[11px] text-white/40">{p.cadastros.length} cadastros no Conta Azul</div>}
                      {p.caIds.length === 0 && <div className="text-[11px] text-warning">sem vinculo com o Conta Azul</div>}
                      {erro[p.chave] && <div className="text-[11px] text-danger">{erro[p.chave]}</div>}
                    </td>
                    <td data-label="Movimentou" className="p-3 text-right tabular-nums text-white/60">
                      {brl(p.valor)}
                      <span className="block text-[11px] text-white/35">{p.vendas} venda{p.vendas === 1 ? "" : "s"}</span>
                    </td>
                    <td data-label="Destino" className="p-3">
                      <select
                        aria-label={`Destino de ${p.nome}`}
                        className="input !py-1.5 text-xs"
                        value={aguardando ? "vendedor" : p.destino}
                        disabled={p.caIds.length === 0 || trabalhando || atualizando}
                        onChange={(e) => mudarDestino(p, e.target.value as Destino)}
                      >
                        {(Object.keys(ROTULO) as Destino[]).map((d) => (
                          <option key={d} value={d}>{ROTULO[d]}</option>
                        ))}
                      </select>
                      {trabalhando && <div className="mt-1 text-[11px] text-white/45">Salvando…</div>}
                    </td>
                    <td data-label="BU" className="p-3">
                      {eVendedor ? (
                        <>
                          <div className="flex gap-1.5 flex-wrap">
                            {ALL_BUS.map((b) => (
                              <button
                                key={b}
                                type="button"
                                disabled={trabalhando}
                                onClick={() => alternarBu(p, b)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                                  p.hub?.bus.includes(b) ? corBu(b) : "bg-panel2 text-white/40 border-border"
                                }`}
                              >
                                {BU_LABEL[b]}
                              </button>
                            ))}
                          </div>
                          {aguardando && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: COLOR.warning }}>
                              Escolha a BU para ativar.
                              {existentes.length > 0 && (
                                <select
                                  aria-label={`Mesma pessoa que ${p.nome}`}
                                  className="input !w-auto !py-0.5 !text-[11px]"
                                  value=""
                                  onChange={(e) => e.target.value && void destino(p, "vendedor", { seller_id: e.target.value })}
                                >
                                  <option value="">ou e a mesma pessoa que…</option>
                                  {existentes.map((x) => (
                                    <option key={x.id} value={x.id}>{x.nome}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                    <td data-label="Status" className="p-3">
                      {eVendedor && p.hub ? (
                        <button
                          type="button"
                          disabled={trabalhando}
                          onClick={() => void enviar(p.chave, `/api/sellers/${p.hub!.id}`, "PATCH", { active: !p.hub!.active })}
                          title={p.hub.active ? "Inativar" : "Ativar"}
                          className={`chip ${p.hub.active ? "bg-success/15 text-success" : "bg-white/10 text-white/50"}`}
                        >
                          <Power className="h-3 w-3" /> {p.hub.active ? "Ativo" : "Inativo"}
                        </button>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                    <td data-label="Senha" className="p-3">
                      {eVendedor && p.hub ? (
                        <button
                          type="button"
                          className={`chip ${p.hub.temSenha ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                          onClick={() => setSenhaDe({ id: p.hub!.id, name: p.nome, has_password: p.hub!.temSenha })}
                          title="Definir / redefinir senha"
                        >
                          <Key className="h-3 w-3" /> {p.hub.temSenha ? "Definida" : "Definir"}
                        </button>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PasswordModal target={senhaDe} onClose={() => setSenhaDe(null)} onDone={() => startTransition(() => router.refresh())} />
    </div>
  );
}

function PasswordModal({
  target,
  onClose,
  onDone,
}: {
  target: { id: string; name: string; has_password: boolean } | null;
  onClose: () => void;
  onDone: () => void;
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
      onDone();
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
        className="bg-panel border border-border rounded-md shadow-glow w-full max-w-sm overflow-hidden"
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
