/**
 * Painel GAV — o primeiro slide da Gestao a Vista (so admin).
 *
 * Responde UMA pergunta: onde a empresa esta em relacao a meta de receita do
 * mes. Cada card tem duas barras na mesma escala — realizado e meta — com o
 * numero escrito em cima. A cor do realizado compara com o RITMO (dias uteis):
 *   verde = no ritmo ou meta batida · amarelo = ate 15% abaixo do ritmo ·
 *   vermelho = mais que isso · cinza = sem meta.
 *
 * Um grafico so (acumulado x ritmo da meta) e cards compactos: empresa, BU,
 * origem e linhas de receita em grade. Sem filtros: o periodo e o do carrossel.
 * O horario do ultimo envio do Conta Azul fica na barra do carrossel.
 */

import type { ReactNode } from "react";
import DuasBarras, { LegendaBarras } from "@/components/DuasBarras";
import DetalheOrigem from "@/components/gav/DetalheOrigem";
import { tomRitmo } from "@/lib/ritmo";
import GavGrafico from "@/components/gav/GavGraficoLazy";
import type { PontoGav } from "@/components/gav/GavGrafico";
import { COLOR } from "@/lib/brand";
import {
  BRL,
  businessDaysElapsed,
  businessDaysInMonth,
  businessDaysRemainingIncludingToday,
  fmtPct,
  isBusinessDay,
  nowRecife,
  paceProjection,
} from "@/lib/calc";
import {
  BU_GESTAO_ROTULO,
  BUS_GESTAO,
  COR_BU,
  COR_ORIGEM,
  ORIGENS,
  ORIGEM_ROTULO,
  type GestaoMes,
} from "@/lib/gestaoAVistaTipos";

const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl = (v: number) => BRL0.format(v);

const tom = tomRitmo;

function Mini({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-panel2/70 px-3 py-2.5">
      <div className="kpi-label truncate !text-[11px]">{rotulo}</div>
      <div className="gav-mini mt-0.5 truncate font-semibold tabular-nums" style={{ color: cor || COLOR.neutral }}>
        {valor}
      </div>
    </div>
  );
}

/**
 * Nome da linha sem o codigo do plano de contas e sem o nome da BU no fim
 * ("1.0 - TURMAS PRESENCIAIS E EVENTOS CPPEM" -> "TURMAS PRESENCIAIS E EVENTOS"):
 * a coluna ja diz a BU. O nome completo fica no `title`.
 */
function nomeCurto(nome: string): string {
  const s = nome
    .replace(/^\s*\d+(\.\d+)*\s*-\s*/, "")
    .replace(/\s+(CPPEM|UNICIVE|COL[EÉ]GIO(\s+CPPEM)?)\s*$/i, "")
    .trim();
  return s || nome;
}

export default function GavPainel({
  dados,
  year,
  month,
  detalheDireto,
}: {
  dados: GestaoMes;
  year: number;
  month: number;
  /** Conteudo do modal aberto ao clicar na origem "Direto" (o antigo slide Direto). */
  detalheDireto?: ReactNode;
}) {
  const meta = dados.metaTotal;
  const temMeta = meta > 0;
  const real = dados.total;
  const pct = temMeta ? (real / meta) * 100 : 0;

  // Ritmo pelos dias uteis (mesma regra dos outros paineis).
  const hoje = nowRecife();
  const corrente = hoje.getFullYear() === year && hoje.getMonth() + 1 === month;
  const duTotal = businessDaysInMonth(year, month);
  const duPassados = businessDaysElapsed(year, month);
  const idealPct = duTotal > 0 ? (duPassados / duTotal) * 100 : 100;
  const ritmo = paceProjection(real, meta, duPassados, duTotal);
  const falta = Math.max(0, meta - real);
  const metaDia = corrente && falta > 0 ? falta / businessDaysRemainingIncludingToday(year, month) : 0;
  const corEmpresa = tom(pct, idealPct, temMeta);

  // Pontos do grafico: ritmo ideal acumulado por dia util.
  let du = 0;
  const pontos: PontoGav[] = dados.dias.map((d) => {
    if (isBusinessDay(year, month, d.dia)) du++;
    return {
      dia: d.dia,
      diario: d.total,
      acumulado: d.acumulado,
      ideal: temMeta && duTotal > 0 ? (meta * du) / duTotal : null,
    };
  });

  const bus = BUS_GESTAO.filter((b) => dados.porBu[b] > 0 || dados.metaPorBu[b] > 0);
  // Linhas de receita de cada BU (meta maior primeiro, depois receita).
  const linhasDaBu = (b: string) =>
    dados.categorias.filter((c) => c.bu === b).sort((x, y) => y.metaValor - x.metaValor || y.valor - x.valor);
  // Largura de cada coluna de BU proporcional ao numero de linhas: BU com mais
  // de 3 linhas ganha 2 subcolunas, para nenhuma coluna ficar muito mais alta.
  const largura = (b: string) => (linhasDaBu(b).length > 3 ? 2 : 1);
  const colunas = bus.map((b) => `${largura(b)}fr`).join(" ");

  return (
    <div className="gav space-y-3">
      {/* 1. Empresa x meta | o grafico unico, com "por origem" na base do mesmo card */}
      <div className="grid gap-3 lg:grid-cols-12">
        <section className="gav-empresa panel p-5 lg:col-span-4 flex flex-col justify-between gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="eyebrow-label">Receita da empresa</div>
            <div className="font-display text-3xl font-bold tabular-nums" style={{ color: corEmpresa }}>
              {temMeta ? fmtPct(pct) : "—"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="kpi-label">Receita</div>
              <div className="mt-1 truncate font-display font-bold leading-none tabular-nums gav-num" style={{ color: corEmpresa === COLOR.mute ? COLOR.neutral : corEmpresa }}>
                {brl(real)}
              </div>
            </div>
            <div className="min-w-0 border-l border-[var(--hair)] pl-3">
              <div className="kpi-label">Meta</div>
              <div className="mt-1 truncate font-display font-bold leading-none tabular-nums gav-num text-white/80">
                {temMeta ? brl(meta) : "—"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Mini rotulo="Falta" valor={temMeta ? (falta > 0 ? brl(falta) : "Meta batida") : "—"} cor={temMeta && falta <= 0 ? COLOR.ok : undefined} />
            <Mini rotulo="Meta do dia" valor={metaDia > 0 ? brl(metaDia) : "—"} cor={metaDia > 0 ? COLOR.warning : undefined} />
            <Mini
              rotulo="Ritmo"
              valor={temMeta ? `${ritmo.paceDelta >= 0 ? "+" : "−"}${brl(Math.abs(ritmo.paceDelta))}` : "—"}
              cor={!temMeta ? undefined : ritmo.paceIsAhead ? COLOR.ok : COLOR.danger}
            />
            <Mini
              rotulo="Projeção"
              valor={temMeta ? `${brl(ritmo.projecao)} · ${fmtPct(ritmo.pctProjecao)}` : brl(ritmo.projecao)}
              cor={!temMeta ? undefined : ritmo.pctProjecao >= 100 ? COLOR.ok : COLOR.danger}
            />
          </div>
        </section>

        <section className="panel p-4 lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="eyebrow-label">Acumulado x ritmo da meta</div>
            <div className="flex items-center gap-3 text-[11px] text-white/45">
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-4 rounded" style={{ background: COLOR.gold }} />Acumulado</span>
              {temMeta && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: COLOR.warning }} />Ritmo</span>}
            </div>
          </div>
          <div className="gav-grafico mt-2 h-[260px] max-sm:h-[240px] flex-1">
            <GavGrafico pontos={pontos} meta={meta} />
          </div>
          {/* Por origem: quem trouxe a receita, na base do grafico */}
          <div className="mt-3 border-t border-[var(--hair)] pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="eyebrow-label">Por origem</div>
              <LegendaBarras />
            </div>
            <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-3">
            {ORIGENS.map((o) => {
              const v = dados.porOrigem[o];
              const m = dados.metaPorOrigem[o];
              const p = m > 0 ? (v / m) * 100 : 0;
              const c = tom(p, idealPct, m > 0);
              const clicavel = o === "direto" && !!detalheDireto;
              const bloco = (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-ui text-[12px] font-bold uppercase tracking-[0.12em]">
                      <i className="h-2 w-2 shrink-0 rounded-sm" style={{ background: COR_ORIGEM[o] }} />
                      <span className="truncate">{o === "diretoria" ? "Diretoria" : ORIGEM_ROTULO[o]}</span>
                      {real > 0 && (
                        <span className="shrink-0 font-sans text-[11px] font-normal normal-case tracking-normal tabular-nums text-white/45" title="Quanto esta origem representa da receita da empresa">
                          {fmtPct((v / real) * 100)}
                        </span>
                      )}
                      {clicavel && <span className="shrink-0 text-[10px] font-semibold text-accent/70 group-hover:text-accent">ver detalhes ›</span>}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: c }}>{m > 0 ? fmtPct(p) : "—"}</span>
                  </div>
                  <DuasBarras real={v} meta={m} cor={m > 0 ? c : COLOR.gold} altura={20} />
                </>
              );
              return (
                <div key={o} className="min-w-0">
                  {clicavel ? (
                    <DetalheOrigem titulo="Direto · detalhes do mês" gatilho={bloco}>
                      {detalheDireto}
                    </DetalheOrigem>
                  ) : (
                    bloco
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </section>
      </div>

      {/* 2. Por BU: uma coluna por BU — o total da BU no topo e as linhas de receita dela embaixo */}
      <section>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
          <div className="eyebrow-label">Por BU e linha de receita</div>
          <LegendaBarras />
        </div>
        {bus.length === 0 ? (
          <p className="panel py-4 text-center text-sm text-white/50">
            {dados.semTabela ? "Rode supabase/ca-03-linha-receita.sql e reprocesse." : "Nenhuma receita neste mês."}
          </p>
        ) : (
          <div className="grid items-start gap-3 lg:[grid-template-columns:var(--cols)]" style={{ ["--cols" as string]: colunas }}>
            {bus.map((b) => {
              const m = dados.metaPorBu[b];
              const v = dados.porBu[b];
              const p = m > 0 ? (v / m) * 100 : 0;
              const c = tom(p, idealPct, m > 0);
              const linhas = linhasDaBu(b);
              return (
                <div key={b} className="panel min-w-0 p-3" style={{ borderTop: `2px solid ${COR_BU[b]}` }}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-ui text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: COR_BU[b] }}>
                        {BU_GESTAO_ROTULO[b]}
                      </span>
                      {real > 0 && (
                        <span className="shrink-0 text-[11px] tabular-nums text-white/45" title="Quanto esta BU representa da receita da empresa">
                          {fmtPct((v / real) * 100)} da empresa
                        </span>
                      )}
                    </span>
                    <span className="font-display text-lg font-bold tabular-nums" style={{ color: c }}>{m > 0 ? fmtPct(p) : "—"}</span>
                  </div>
                  <DuasBarras real={v} meta={m} cor={m > 0 ? c : COLOR.gold} altura={24} />
                  {linhas.length > 0 && (
                    <div className={`mt-2.5 grid gap-x-3 gap-y-2 border-t border-[var(--hair)] pt-2.5 ${largura(b) === 2 ? "sm:grid-cols-2" : ""}`}>
                      {linhas.map((l) => {
                        const tm = l.metaValor > 0;
                        const pl = tm ? (l.valor / l.metaValor) * 100 : 0;
                        const cl = tom(pl, idealPct, tm);
                        return (
                          <div key={l.chave} className="min-w-0">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-baseline gap-1.5">
                                <span className="truncate text-[12px] text-white/80" title={l.rotulo}>{nomeCurto(l.rotulo)}</span>
                                {v > 0 && (
                                  <span className="shrink-0 text-[11px] tabular-nums text-white/45" title="Quanto esta linha representa da receita da BU">
                                    {fmtPct((l.valor / v) * 100)}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: cl }}>{tm ? fmtPct(pl) : "sem meta"}</span>
                            </div>
                            <DuasBarras real={l.valor} meta={l.metaValor} cor={COLOR.gold} altura={22} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
