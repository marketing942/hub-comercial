/**
 * Painel GAV — o primeiro slide da Gestao a Vista (so admin). Versao 2 (25/11/2026).
 *
 * Lido de cima para baixo, como uma reuniao de gestao:
 *   1. ESQUERDA: "Receita CPPEM Educacao" (realizado, meta, falta, % e, embaixo, as
 *      origens sem barras) em cima do acumulado x ritmo | DIREITA: Por BU (barras grossas).
 *   2. Linhas de receita: um card, grade de 4, BU = bolinha colorida ao lado do nome.
 *
 * Barras: duas barras (meta cinza em cima, realizado dourado embaixo, via
 * `BarraBala` -> `DuasBarras`). A cor (`tomRitmo`) vai SO no numero/%.
 * Sem filtros: o periodo e o do carrossel.
 */

import type { ReactNode } from "react";
import BarraSegmentada, { LegendaSegmentada } from "@/components/gav/BarraSegmentada";
import DetalheOrigem from "@/components/gav/DetalheOrigem";
import Dica from "@/components/gav/Dica";
import { tomRitmo } from "@/lib/ritmo";
import UnifiedDailyChart, { type UnifiedChartRow } from "@/components/charts/UnifiedDailyChartLazy";
import { COLOR } from "@/lib/brand";
import {
  businessDaysElapsed,
  businessDaysInMonth,
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

/**
 * Nome da linha sem o codigo do plano de contas e sem o nome da BU no fim
 * ("1.0 - TURMAS PRESENCIAIS E EVENTOS CPPEM" -> "TURMAS PRESENCIAIS E EVENTOS"):
 * a coluna ja diz a BU. O nome completo fica no `title`.
 */
function nomeCurto(nome: string): string {
  const s = nome
    .replace(/^\s*\d+(\.\d+)*\s*-\s*/, "")
    .replace(/\s+(D[OE]\s+)?(CPPEM|UNICIVE|COL[EÉ]GIO(\s+CPPEM)?)\s*$/i, "")
    .trim();
  return s || nome;
}

/**
 * Ordem fixa das linhas de receita no GAV (da esquerda para a direita, 4 por linha).
 * Casa pelo nome curto da categoria do Conta Azul, sem acento, e pela BU.
 * "Eventos" e "Multas" valem para qualquer BU.
 */
const ORDEM_LINHAS: { bu?: string; casa: (n: string) => boolean }[] = [
  { bu: "cppem", casa: (n) => n.startsWith("MENTORIAS") },
  { bu: "cppem", casa: (n) => n.startsWith("TURMAS PRESENCIAIS") },
  { bu: "cppem", casa: (n) => n.startsWith("CURSOS ONLINE") },
  { bu: "cppem", casa: (n) => n.startsWith("MATERIAIS DIGITAIS") },
  { bu: "cppem", casa: (n) => n.startsWith("MATERIAIS FISICOS") },
  { bu: "cppem", casa: (n) => n.startsWith("SUPLETIVO") },
  { bu: "unicive", casa: (n) => n.startsWith("MATRICULA") },
  { casa: (n) => n.includes("REPASSE") },
  { bu: "colegio_cppem", casa: (n) => n.startsWith("MATRICULA") && !n.includes("REMATR") },
  { bu: "colegio_cppem", casa: (n) => n.includes("REMATR") },
  { bu: "colegio_cppem", casa: (n) => n.startsWith("MENSALIDADE") },
  { bu: "colegio_cppem", casa: (n) => n.startsWith("FARDAMENTO") },
  { casa: (n) => n.startsWith("EVENTOS") },
  { casa: (n) => n.startsWith("MULTA") },
];
function posicaoDaLinha(rotulo: string, bu: string): number {
  const n = nomeCurto(rotulo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const i = ORDEM_LINHAS.findIndex((o) => (!o.bu || o.bu === bu) && o.casa(n));
  return i >= 0 ? i : ORDEM_LINHAS.length;
}

/** Uma linha "nome · fatia ......... R$ real / R$ meta  %" com a barra de bala embaixo. */
function LinhaBala({
  rotulo,
  titulo,
  dica,
  real,
  meta,
  idealPct,
  altura = 9,
  marca,
  ponto,
  extra,
  grande,
}: {
  rotulo: string;
  titulo?: string;
  /** Texto da dica (i) ao lado do nome: participacao na receita (26/11/2026, no lugar do % solto). */
  dica?: string;
  real: number;
  meta: number;
  idealPct: number;
  altura?: number;
  /** Quadradinho de cor antes do nome (identidade da origem). */
  marca?: string;
  /** Bolinha de cor antes do nome (identidade da origem). */
  ponto?: string;
  extra?: ReactNode;
  grande?: boolean;
}) {
  const tm = meta > 0;
  const p = tm ? (real / meta) * 100 : 0;
  return (
    // A cor da BU e uma barrinha vertical do NOME ate a ultima barra (26/11/2026).
    <div className={`relative min-w-0 ${marca ? "pl-3" : ""}`}>
      {marca && <i aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-full" style={{ background: marca }} />}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {ponto && <i className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: ponto }} />}
          <span
            className={grande ? "shrink-0 font-ui text-[13px] font-bold uppercase tracking-[0.12em]" : "truncate text-[12px] font-medium text-white"}
            title={titulo || rotulo}
          >
            {rotulo}
          </span>
          {dica && <Dica texto={dica} />}
          {extra}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums">
          {tm ? (
            <b className="ml-1.5 inline-block min-w-[3.2em] text-right" style={{ color: tom(p, idealPct, true) }}>
              {fmtPct(p)}
            </b>
          ) : (
            <span className="text-white/40">sem meta</span>
          )}
        </span>
      </div>
      <BarraSegmentada real={real} meta={meta} altura={altura} />
    </div>
  );
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
  const corEmpresa = tom(pct, idealPct, temMeta);

  // Linhas do grafico (mesmo formato da Evolucao diaria): faturamento do dia, % da meta
  // acumulada e % ideal pelos dias uteis.
  let du = 0;
  let acc = 0;
  const mm = String(month).padStart(2, "0");
  const linhasGrafico: UnifiedChartRow[] = dados.dias.map((d) => {
    if (isBusinessDay(year, month, d.dia)) du++;
    acc += d.total;
    return {
      day: `${String(d.dia).padStart(2, "0")}/${mm}`,
      valor: d.total,
      pct: temMeta ? (acc / meta) * 100 : 0,
      idealPct: duTotal > 0 ? (du / duTotal) * 100 : 0,
    };
  });

  const bus = BUS_GESTAO.filter((b) => dados.porBu[b] > 0 || dados.metaPorBu[b] > 0);
  // Todas as linhas de receita num card so, na ORDEM FIXA pedida pelo time (26/11/2026;
  // ver ORDEM_LINHAS). Linha que nao bate com nenhuma regra vai para o fim, BU por BU.
  const linhas = bus
    .flatMap((b) => dados.categorias.filter((c) => c.bu === b))
    .map((c, k) => ({ c, k, r: posicaoDaLinha(c.rotulo, c.bu) }))
    .sort((x, y) => x.r - y.r || x.k - y.k)
    .map((x) => x.c);

  return (
    <div className="gav space-y-2">
      <div className="grid items-stretch gap-2 xl:grid-cols-12">
        {/* ONDE ESTAMOS: realizado, meta, falta e % lado a lado, compacto (o realizado so um
            pouco maior que a meta). Fica em cima do grafico, na coluna da esquerda, e libera
            a direita para o "Por origem" subir. So o % tem cor. */}
        {/* RECEITA CPPEM EDUCACAO (26/11/2026): uma TABELA. Linha 1 = receita total
            (numeros grandes); embaixo, uma linha por origem com as MESMAS colunas —
            realizado, meta, gap/superavit e % da meta — em numeros menores. A fatia de
            cada origem na receita total fica na dica (i). Numeros seguem a largura do
            card (cqi): nunca quebram de linha. */}
        <section className="gav-hero panel flex flex-col px-5 py-4 xl:col-span-7">
          <div className="eyebrow-label">Receita CPPEM Educação</div>
          <div className="mt-3 grid grid-cols-[max-content_max-content_max-content_max-content] items-end gap-x-4 max-sm:overflow-x-auto [&>.col]:border-l [&>.col]:border-[var(--hair)] [&>.col]:pl-4">
            {/* Receita total */}
            <div>
              <div className="kpi-label">Realizado</div>
              <div className="gav-hero-num mt-1.5 font-display font-bold leading-none tabular-nums text-white">{brl(real)}</div>
            </div>
            <div className="col">
              <div className="kpi-label">Meta</div>
              <div className="gav-hero-sub mt-1.5 whitespace-nowrap font-display font-bold leading-none tabular-nums text-white/95">{temMeta ? brl(meta) : "—"}</div>
            </div>
            <div className="col">
              <div className="kpi-label">{temMeta && falta <= 0 ? "Superavit" : "Gap"}</div>
              <div className="gav-hero-sub mt-1.5 whitespace-nowrap font-display font-bold leading-none tabular-nums text-white/95">
                {!temMeta ? "—" : falta > 0 ? `−${brl(falta)}` : `+${brl(real - meta)}`}
              </div>
            </div>
            <div className="col">
              <div className="kpi-label">Da meta</div>
              <div className="gav-hero-sub mt-1.5 whitespace-nowrap font-display font-bold leading-none tabular-nums" style={{ color: corEmpresa }}>
                {temMeta ? fmtPct(pct) : "—"}
              </div>
            </div>

          </div>
          {/* Por origem (26/11/2026): barras segmentadas lado a lado (realizado x falta). */}
          <div className="mt-4 grid gap-x-5 gap-y-3 border-t border-[var(--hair)] pt-3 sm:grid-cols-3">
            {ORIGENS.map((o) => (
              <LinhaBala
                key={o}
                grande
                ponto={COR_ORIGEM[o]}
                rotulo={ORIGEM_ROTULO[o]}
                dica={real > 0 ? `${ORIGEM_ROTULO[o]} representa ${fmtPct((dados.porOrigem[o] / real) * 100)} da receita total do grupo educacional.` : undefined}
                real={dados.porOrigem[o]}
                meta={dados.metaPorOrigem[o]}
                idealPct={idealPct}
                altura={12}
                extra={
                  o === "direto" && detalheDireto ? (
                    <DetalheOrigem titulo="Direto · detalhes do mês" inline gatilho={<span className="text-[10px] font-semibold text-accent/70 hover:text-accent">detalhes ›</span>}>
                      {detalheDireto}
                    </DetalheOrigem>
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>

          {/* Por BU: barras grossas — meta, realizado e quanto falta (26/11/2026). */}
          <section className="gav-porbu panel flex flex-col p-4 xl:col-span-5">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="eyebrow-label">Por BU</div>
              <LegendaSegmentada />
            </div>
            {bus.length === 0 ? (
              <p className="my-auto text-center text-sm text-white/50">
                {dados.semTabela ? "Rode supabase/ca-03-linha-receita.sql e reprocesse." : "Nenhuma receita neste mês."}
              </p>
            ) : (
              <div className="flex flex-1 flex-col justify-around gap-3">
                {bus.map((b) => (
                  <LinhaBala
                    key={b}
                    grande
                    rotulo={BU_GESTAO_ROTULO[b]}
                    dica={real > 0 ? `Esta BU representa ${fmtPct((dados.porBu[b] / real) * 100)} da receita total do grupo educacional.` : undefined}
                    real={dados.porBu[b]}
                    meta={dados.metaPorBu[b]}
                    idealPct={idealPct}
                    altura={14}
                  />
                ))}
              </div>
            )}
          </section>

      </div>

      {/* GRAFICO + LINHAS DE RECEITA num card so (26/11/2026): o acumulado x ritmo em cima,
          na horizontal, e as linhas de receita embaixo, grade de 4 — a mesma historia. A BU
          de cada linha e a bolinha colorida ao lado do nome. */}
      <section className="panel p-4">
          {/* Mesmo componente da "Evolucao diaria" dos paineis das BUs (26/11/2026):
              faturamento do dia em barras, % da meta acumulada, % ideal (dias uteis) e projecao. */}
          <div className="eyebrow-label mb-2">Acumulado x ritmo da meta</div>
          <div className="gav-grafico">
            <UnifiedDailyChart
              data={linhasGrafico}
              leftUnit="currency"
              rightUnit="percent"
              rightPercentScale
              showIdealReference
              today={corrente ? hoje.getDate() : undefined}
              height="var(--gav-graf-h, 260px)"
              series={[
                { key: "valor", label: "Faturamento (dia)", color: COLOR.gold, axis: "left", unit: "currency", strokeWidth: 2.5 },
                { key: "pct", label: "% Meta acumulada", color: corEmpresa === COLOR.mute ? COLOR.gold : corEmpresa, axis: "right", unit: "percent", strokeWidth: 3 },
                { key: "idealPct", label: "% Ideal", color: COLOR.warning, axis: "right", unit: "percent", dashed: true, strokeWidth: 1.5 },
              ]}
            />
          </div>
        <div className="mt-3 border-t border-[var(--hair)] pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <div className="eyebrow-label">Linhas de receita</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-white/45">
                {bus.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5">
                    <i className="h-3 w-[3px] rounded-full" style={{ background: COR_BU[b] }} />
                    {BU_GESTAO_ROTULO[b]}
                  </span>
                ))}
              </span>
              <LegendaSegmentada />
            </div>
          </div>
          <div className="linhas-receita grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {linhas.map((l) => (
              <LinhaBala
                key={l.chave}
                marca={COR_BU[l.bu]}
                rotulo={nomeCurto(l.rotulo)}
                titulo={`${BU_GESTAO_ROTULO[l.bu]} · ${l.rotulo}`}
                dica={
                  real > 0
                    ? `Essa linha de receita representa ${fmtPct((l.valor / real) * 100)} da receita total do grupo educacional e ${fmtPct(dados.porBu[l.bu] > 0 ? (l.valor / dados.porBu[l.bu]) * 100 : 0)} da BU.`
                    : undefined
                }
                real={l.valor}
                meta={l.metaValor}
                idealPct={idealPct}
                altura={11}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
