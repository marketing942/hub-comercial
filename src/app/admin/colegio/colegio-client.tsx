"use client";
/**
 * Planilha de matriculas do Colegio (Configuracoes -> Colegio). Busca o dado
 * fresco ao montar (o Router Cache guardaria props velhas) e so deixa editar
 * depois que ele chega. Contas em lib/colegioMatriculas.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { RotateCw, Save } from "lucide-react";
import NumberField from "@/components/NumberField";
import { COLOR } from "@/lib/brand";
import {
  ANO_LETIVO,
  SERIES,
  ehConcluinte,
  erroDaLinha,
  gradeVazia,
  normalizarLinha,
  resumir,
  semRespostaDaLinha,
  type GradeColegio,
  type LinhaSerie,
} from "@/lib/colegioMatriculas";

const CAMPOS: { k: keyof LinhaSerie; rotulo: string }[] = [
  { k: "alunos_hoje", rotulo: `Alunos hoje (${ANO_LETIVO - 1})` },
  { k: "rematriculas", rotulo: `Rematriculas p/ ${ANO_LETIVO}` },
  { k: "desistencias", rotulo: "Desistencias" },
  { k: "novas", rotulo: `Novas matriculas ${ANO_LETIVO}` },
];

export default function ColegioClient() {
  const [grade, setGrade] = useState<GradeColegio>(gradeVazia);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "semTabela" | "falhou">("carregando");
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [atualizado, setAtualizado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/colegio/matriculas", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (j.semTabela) return setEstado("semTabela");
        setGrade(j.grade);
        setAtualizado(j.atualizadoEm);
        setEstado("pronto");
      })
      .catch(() => setEstado("falhou"));
  }, []);

  const r = useMemo(() => resumir(grade), [grade]);
  const erros = SERIES.filter((s) => erroDaLinha(s.id, normalizarLinha(s.id, grade[s.id])));
  const travado = estado !== "pronto";

  function mudar(id: string, k: keyof LinhaSerie, v: number) {
    setGrade((g) => ({ ...g, [id]: { ...g[id], [k]: Math.max(0, Math.floor(v || 0)) } }));
    setSujo(true);
    setMsg(null);
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const res = await fetch("/api/colegio/matriculas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grade }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setSalvando(false);
    if (res?.ok) {
      setSujo(false);
      setAtualizado(j?.atualizadoEm ?? null);
      setMsg({ ok: true, t: "Salvo. O painel do Colegio ja reflete." });
    } else {
      setMsg({ ok: false, t: j?.error || "Erro ao salvar." });
    }
  }

  const quando = atualizado
    ? new Date(atualizado).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-3">
      <div className="panel sticky top-[7.25rem] z-10 flex flex-wrap items-center gap-x-5 gap-y-2 p-3 text-xs text-white/55">
        <span>Confirmados {ANO_LETIVO}: <b className="text-sm text-white">{r.confirmados}</b></span>
        <span>Rematriculas: <b className="text-white/90">{r.rematriculas}</b></span>
        <span>Novas: <b className="text-white/90">{r.novas}</b></span>
        <span>Sem resposta: <b className="text-white/90">{r.semResposta}</b></span>
        <div className="flex-1" />
        {erros.length > 0 ? (
          <span style={{ color: COLOR.danger }}>Corrija {erros.length} serie{erros.length > 1 ? "s" : ""} para salvar</span>
        ) : msg ? (
          <span style={{ color: msg.ok ? COLOR.ok : COLOR.danger }}>{msg.t}</span>
        ) : sujo ? (
          <span style={{ color: COLOR.warning }}>Alteracoes nao salvas</span>
        ) : quando ? (
          <span>Ultima atualizacao: {quando}</span>
        ) : null}
        <button className="btn-primary !py-1.5 text-sm" onClick={() => void salvar()} disabled={travado || salvando || !sujo || erros.length > 0}>
          {salvando ? <RotateCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {estado === "semTabela" && (
        <div className="panel p-4 text-sm" style={{ color: COLOR.warning }}>
          Falta criar a tabela no banco: rode <b>supabase/colegio-matriculas.sql</b> no SQL Editor do Supabase e recarregue a pagina.
        </div>
      )}
      {estado === "falhou" && <div className="panel p-4 text-sm" style={{ color: COLOR.danger }}>Nao foi possivel carregar. Recarregue a pagina.</div>}

      <section className="panel overflow-hidden">
        <table className="table-stack w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-white/40">
            <tr className="text-left">
              <th className="px-4 py-2">Serie</th>
              {CAMPOS.map((c) => (
                <th key={c.k} className="px-2 py-2">{c.rotulo}</th>
              ))}
              <th className="px-4 py-2 text-right">Sem resposta</th>
            </tr>
          </thead>
          <tbody>
            {SERIES.map((s) => {
              const l = grade[s.id];
              const conc = ehConcluinte(s.id);
              const erro = erroDaLinha(s.id, normalizarLinha(s.id, l));
              return (
                <tr key={s.id} className="border-t border-[var(--hair)] align-top">
                  <td data-label="Serie" className="px-4 py-2 font-medium">
                    {s.nome}
                    {conc && <div className="text-[11px] font-normal text-white/45">Concluintes: nao rematriculam</div>}
                    {erro && <div className="text-[11px] font-normal" style={{ color: COLOR.danger }}>{erro}</div>}
                  </td>
                  {CAMPOS.map((c) => {
                    const bloqueado = conc && (c.k === "rematriculas" || c.k === "desistencias");
                    return (
                      <td key={c.k} data-label={c.rotulo} className="px-2 py-1.5">
                        {bloqueado ? (
                          <span className="inline-block py-2 text-white/30">—</span>
                        ) : (
                          <NumberField
                            aria-label={`${c.rotulo} - ${s.nome}`}
                            className={`input h-9 !w-28 ${erro ? "!border-danger" : ""}`}
                            min={0}
                            step={1}
                            value={l[c.k]}
                            onChange={(v) => mudar(s.id, c.k, v)}
                            disabled={travado}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td data-label="Sem resposta" className="px-4 py-2 text-right font-semibold tabular-nums">
                    {conc ? <span className="text-white/30">—</span> : semRespostaDaLinha(s.id, l)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-panel2/60 font-bold tabular-nums">
              <td data-label="Total" className="px-4 py-2">Total</td>
              <td data-label={CAMPOS[0].rotulo} className="px-2 py-2">{r.alunosHoje}</td>
              <td data-label={CAMPOS[1].rotulo} className="px-2 py-2">{r.rematriculas}</td>
              <td data-label={CAMPOS[2].rotulo} className="px-2 py-2">{r.desistencias}</td>
              <td data-label={CAMPOS[3].rotulo} className="px-2 py-2">{r.novas}</td>
              <td data-label="Sem resposta" className="px-4 py-2 text-right">{r.semResposta}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
