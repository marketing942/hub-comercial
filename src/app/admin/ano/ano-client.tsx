"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NumberField from "@/components/NumberField";
import Cell from "@/components/StatCell";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { BU_LABEL, COLOR } from "@/lib/brand";
import { ALL_BUS, type BU } from "@/lib/products";
import {
  MONTHS_SHORT,
  YEAR_MAX,
  YEAR_MIN,
  monthConversao,
  monthLeads,
  monthTicket,
  totalsOf,
  type YearGrid,
  type YearMonthRow,
} from "@/lib/yearMath";

type Field = keyof YearMonthRow;
type Status = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 700;

export default function AnoClient({
  year,
  initialGrid,
  initialTableMissing,
}: {
  year: number;
  initialGrid: YearGrid;
  initialTableMissing: boolean;
}) {
  const router = useRouter();
  const [bu, setBu] = useState<BU>("cppem");
  const [grid, setGrid] = useState<YearGrid>(initialGrid);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(initialTableMissing);
  // Os campos ficam travados ate chegarem os dados FRESCOS do servidor. O Next
  // reaproveita no navegador a pagina ja visitada (ao voltar por link ela vem de
  // antes das edicoes); digitar em cima dela gravaria o mes inteiro com valores
  // velhos e poderia zerar vendas/leads que ja estavam no banco.
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const dirty = useRef(false); // true = ha edicao local ainda nao confirmada no banco
  const locked = tableMissing || !ready;

  // A grade mais recente, pro salvamento (debounced) nunca usar valor velho.
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef(0);

  async function flush(b: BU, m: number) {
    delete timers.current[`${b}:${m}`];
    const row = gridRef.current[b][m];
    inflight.current += 1;
    setStatus("saving");
    try {
      const r = await fetch("/api/year", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bu: b, year, month: m, ...row }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao salvar.");
      }
      setErrMsg(null);
      inflight.current -= 1;
      if (inflight.current === 0 && Object.keys(timers.current).length === 0) {
        dirty.current = false;
        setStatus("saved");
      }
    } catch (e: any) {
      inflight.current -= 1;
      setErrMsg(e?.message || "Erro ao salvar.");
      setStatus("error");
    }
  }

  // Busca os dados frescos. Nunca sobrescreve o que o usuario esta editando.
  const refresh = useCallback(async () => {
    const busy = () =>
      dirty.current || inflight.current > 0 || Object.keys(timers.current).length > 0;
    if (busy()) return;
    try {
      const r = await fetch(`/api/year?year=${year}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (busy()) return; // o usuario comecou a editar enquanto buscava
      setGrid(j.grid as YearGrid);
      setTableMissing(Boolean(j.tableMissing));
      setLoadErr(false);
      setReady(true);
    } catch {
      setLoadErr(true);
    }
  }, [year]);

  // Ao abrir e ao voltar pra esta janela (ex.: depois de rodar um SQL no Supabase).
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // Ao sair da aba (ou trocar de ano), grava o que ainda estava pendente.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const key of Object.keys(pending)) {
        clearTimeout(pending[key]);
        const [b, m] = key.split(":");
        void flush(b as BU, Number(m));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCell(m: number, field: Field, v: number) {
    const value = v < 0 ? 0 : v;
    dirty.current = true;
    setGrid((prev) => ({
      ...prev,
      [bu]: { ...prev[bu], [m]: { ...prev[bu][m], [field]: value } },
    }));
    const key = `${bu}:${m}`;
    clearTimeout(timers.current[key]);
    setStatus("saving");
    const b = bu;
    timers.current[key] = setTimeout(() => flush(b, m), SAVE_DELAY_MS);
  }

  function goYear(y: number) {
    router.push(`/admin/ano?year=${y}`);
  }

  const months = grid[bu];
  const tot = totalsOf(months);
  const qtdLabel = bu === "cppem" ? "Qtd de vendas" : "Matriculas";
  const rows: { field: Field; label: string; step?: string }[] = [
    { field: "receita", label: "Receita total (R$)", step: "0.01" },
    { field: "qtd", label: qtdLabel },
    { field: "leads_pago", label: "Leads pagos" },
    { field: "leads_organico", label: "Leads organicos" },
  ];

  const dash = (n: number, fmt: (x: number) => string) => (n > 0 ? fmt(n) : "—");
  const thMonth =
    "px-2 py-3 text-center font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-white/50";
  const tdCalc = "px-3 py-2.5 text-right tabular-nums text-xs font-semibold";

  return (
    <div className="space-y-4">
      {tableMissing && (
        <div className="panel p-4 text-sm" style={{ borderColor: "rgba(240,180,76,0.45)" }}>
          <div className="eyebrow-label" style={{ color: COLOR.warning }}>Tabela ainda nao criada</div>
          <p className="mt-1.5 text-white/70">
            Rode o arquivo <b>supabase/migrate-realizado-ano.sql</b> no SQL Editor do Supabase.
            Ele cria a tabela e traz os dados do painel antigo. Enquanto isso, a aba abre vazia e
            nao consegue salvar.
          </p>
        </div>
      )}
      {loadErr && !ready && (
        <div className="panel p-4 text-sm" style={{ borderColor: "rgba(238,125,115,0.45)" }}>
          <div className="eyebrow-label" style={{ color: COLOR.danger }}>Nao foi possivel carregar os dados</div>
          <p className="mt-1.5 text-white/70">
            Para nao gravar por cima de valores antigos, os campos ficam travados. Recarregue a pagina (F5).
          </p>
        </div>
      )}

      {/* Barra: BU + ano + status do salvamento */}
      <div className="panel p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-panel border border-border flex-wrap">
          {ALL_BUS.map((b) => (
            <button
              key={b}
              onClick={() => setBu(b)}
              className={`px-4 py-1.5 rounded-lg font-ui text-[13px] font-bold uppercase tracking-wider transition ${
                b === bu ? "bg-accent text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {BU_LABEL[b]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs min-w-[7rem] text-right"
            style={{
              color:
                status === "error"
                  ? COLOR.danger
                  : status === "saved"
                  ? COLOR.ok
                  : COLOR.mute,
            }}
          >
            {status === "saving" && "Salvando..."}
            {status === "saved" && "Salvo"}
            {status === "error" && (errMsg || "Erro ao salvar.")}
          </span>
          <button
            className="btn-ghost h-9 w-9 !p-0"
            onClick={() => goYear(year - 1)}
            disabled={year <= YEAR_MIN}
            aria-label="Ano anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-display text-xl font-bold tabular-nums w-16 text-center">{year}</span>
          <button
            className="btn-ghost h-9 w-9 !p-0"
            onClick={() => goYear(year + 1)}
            disabled={year >= YEAR_MAX}
            aria-label="Proximo ano"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resumo do ano da BU selecionada */}
      <section className="panel overflow-hidden">
        <div className="-ml-px -mt-px grid grid-cols-2 md:grid-cols-5">
          <Cell label={`Receita ${year}`} value={BRL.format(tot.receita)} />
          <Cell label={bu === "cppem" ? "Vendas" : "Matriculas"} value={fmtInt.format(tot.qtd)} />
          <Cell label="Leads" value={fmtInt.format(tot.leads)}>
            {fmtInt.format(tot.leadsPago)} pagos · {fmtInt.format(tot.leadsOrganico)} organicos
          </Cell>
          <Cell label="Ticket medio" value={dash(tot.ticket, (n) => BRL.format(n))} tone={COLOR.info} />
          <Cell label="Conversao" value={dash(tot.conversao, fmtPct)} tone={COLOR.info} />
        </div>
      </section>

      {/* Planilha: 12 meses + total do ano */}
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-xs">
            <thead>
              <tr className="border-b border-[var(--hair)]">
                <th className="sticky left-0 z-10 bg-panel px-4 py-3 text-left eyebrow-label">
                  Indicador
                </th>
                {MONTHS_SHORT.map((m) => (
                  <th key={m} className={thMonth} style={{ minWidth: 92 }}>
                    {m}
                  </th>
                ))}
                <th
                  className="border-l border-[var(--hair)] px-3 py-3 text-center font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-accent"
                  style={{ minWidth: 120 }}
                >
                  Ano
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const total =
                  row.field === "receita"
                    ? BRL.format(tot.receita)
                    : fmtInt.format(
                        row.field === "qtd"
                          ? tot.qtd
                          : row.field === "leads_pago"
                          ? tot.leadsPago
                          : tot.leadsOrganico
                      );
                return (
                  <tr key={row.field} className="border-b border-[var(--hair)]">
                    <td className="sticky left-0 z-10 bg-panel px-4 py-2 font-semibold text-white/85 whitespace-nowrap">
                      {row.label}
                    </td>
                    {MONTHS_SHORT.map((mn, i) => {
                      const m = i + 1;
                      return (
                        <td key={m} className="px-1.5 py-1.5">
                          <NumberField
                            key={`${bu}-${m}-${row.field}`}
                            className="input !px-2 !py-1.5 text-right text-xs tabular-nums disabled:opacity-50"
                            step={row.step}
                            min={0}
                            value={months[m][row.field]}
                            onChange={(v) => setCell(m, row.field, v)}
                            disabled={locked}
                            aria-label={`${row.label} ${mn}`}
                          />
                        </td>
                      );
                    })}
                    <td className="border-l border-[var(--hair)] px-3 py-2 text-right tabular-nums font-bold text-accent">
                      {total}
                    </td>
                  </tr>
                );
              })}

              {/* Linhas calculadas (somente leitura) */}
              <tr className="border-b border-[var(--hair)] bg-white/[0.02]">
                <td className="sticky left-0 z-10 bg-panel px-4 py-2.5 font-semibold text-white/60 whitespace-nowrap">
                  Leads totais
                </td>
                {MONTHS_SHORT.map((_, i) => (
                  <td key={i} className={tdCalc} style={{ color: COLOR.mute }}>
                    {dash(monthLeads(months[i + 1]), fmtInt.format)}
                  </td>
                ))}
                <td className={`${tdCalc} border-l border-[var(--hair)]`} style={{ color: COLOR.neutral }}>
                  {dash(tot.leads, fmtInt.format)}
                </td>
              </tr>
              <tr className="border-b border-[var(--hair)] bg-white/[0.02]">
                <td className="sticky left-0 z-10 bg-panel px-4 py-2.5 font-semibold text-white/60 whitespace-nowrap">
                  Ticket medio
                </td>
                {MONTHS_SHORT.map((_, i) => (
                  <td key={i} className={tdCalc} style={{ color: COLOR.info }}>
                    {dash(monthTicket(months[i + 1]), (n) => BRL.format(n))}
                  </td>
                ))}
                <td className={`${tdCalc} border-l border-[var(--hair)]`} style={{ color: COLOR.info }}>
                  {dash(tot.ticket, (n) => BRL.format(n))}
                </td>
              </tr>
              <tr className="bg-white/[0.02]">
                <td className="sticky left-0 z-10 bg-panel px-4 py-2.5 font-semibold text-white/60 whitespace-nowrap">
                  Conversao
                </td>
                {MONTHS_SHORT.map((_, i) => (
                  <td key={i} className={tdCalc} style={{ color: COLOR.info }}>
                    {dash(monthConversao(months[i + 1]), fmtPct)}
                  </td>
                ))}
                <td className={`${tdCalc} border-l border-[var(--hair)]`} style={{ color: COLOR.info }}>
                  {dash(tot.conversao, fmtPct)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-white/35">
        Ticket medio = receita ÷ {qtdLabel.toLowerCase()}. Conversao = {qtdLabel.toLowerCase()} ÷ (leads pagos + organicos).
        Estes valores sao independentes das vendas lancadas no Hub.
      </p>
    </div>
  );
}
