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
import BarraBala, { LegendaBala } from "@/components/gav/BarraBala";
import DetalheOrigem from "@/components/gav/DetalheOrigem";
import Dica from "@/components/gav/Dica";
import { tomRitmo } from "@/lib/ritmo";
import GavGrafico from "@/components/gav/GavGraficoLazy";
import type { PontoGav } from "@/components/gav/GavGrafico";
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
    .replace(/\s+(CPPEM|UNICIVE|COL[EÉ]GIO(\s+CPPEM)?)\s*$/i, "")
    .trim();
  return s || nome;
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
  extra,
  grande,
  falta,
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
  extra?: ReactNode;
  grande?: boolean;
  /** 3a barra com quanto falta para a meta. */
  falta?: boolean;
}) {
  const tm = meta > 0;
  const p = tm ? (real / meta) * 100 : 0;
  return (
    // A cor da BU e uma barrinha vertical do NOME ate a ultima barra (26/11/2026).
    <div className={`relative min-w-0 ${marca ? "pl-3" : ""}`}>
      {marca && <i aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-full" style={{ background: marca }} />}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
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
      <BarraBala real={real} meta={meta} idealPct={idealPct} altura={altura} falta={falta} />
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

  // Selo de situacao da empresa.
  const selo = !temMeta
    ? { txt: "Sem meta", cor: COLOR.mute }
    : pct >= 100
      ? { txt: "Meta batida", cor: COLOR.ok }
      : !corrente
        ? { txt: "Meta nao batida", cor: COLOR.danger }
        : ritmo.paceIsAhead
          ? { txt: "Acima do ritmo", cor: COLOR.ok }
          : { txt: "Abaixo do ritmo", cor: corEmpresa };

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
  // Todas as linhas de receita num card so: BU por BU (na ordem das BUs) e, dentro
  // da BU, meta maior primeiro, depois receita.
  const linhas = bus.flatMap((b) =>
    dados.categorias.filter((c) => c.bu === b).sort((x, y) => y.metaValor - x.metaValor || y.valor - x.valor)
  );

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
          <div className="flex items-center gap-3">
            <div className="eyebrow-label">Receita CPPEM Educação</div>
            <span
              className="shrink-0 rounded-full border px-2.5 py-0.5 font-ui text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: selo.cor, borderColor: `${selo.cor}55`, background: `${selo.cor}14` }}
            >
              {selo.txt}
            </span>
          </div>
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

            {/* Separador */}
            <div className="col-span-4 my-3 h-px bg-[var(--hair)]" />

            {/* Uma linha por origem, mesmas colunas */}
            {ORIGENS.flatMap((o) => {
              const v = dados.porOrigem[o];
              const m = dados.metaPorOrigem[o];
              const g = v - m;
              return [
                <div key={`${o}-r`} className="pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_ORIGEM[o] }} />
                    <span className="kpi-label">{ORIGEM_ROTULO[o]}</span>
                    {real > 0 && <Dica texto={`${ORIGEM_ROTULO[o]} representa ${fmtPct((v / real) * 100)} da receita total do grupo educacional.`} />}
                    {o === "direto" && detalheDireto && (
                      <DetalheOrigem titulo="Direto · detalhes do mês" inline gatilho={<span className="text-[10px] font-semibold text-accent/70 hover:text-accent">detalhes ›</span>}>
                        {detalheDireto}
                      </DetalheOrigem>
                    )}
                  </div>
                  <div className="gav-hero-origem mt-1 font-display font-bold leading-none tabular-nums text-white/90">{brl(v)}</div>
                </div>,
                <div key={`${o}-m`} className="col flex items-end self-stretch pb-2.5">
                  <div className="gav-hero-origem font-display font-bold leading-none tabular-nums text-white/70">{m > 0 ? brl(m) : "—"}</div>
                </div>,
                <div key={`${o}-g`} className="col flex items-end self-stretch pb-2.5">
                  <div className="gav-hero-origem whitespace-nowrap font-display font-bold leading-none tabular-nums text-white/70">
                    {m > 0 ? `${g >= 0 ? "+" : "−"}${brl(Math.abs(g))}` : "—"}
                  </div>
                </div>,
                <div key={`${o}-p`} className="col flex items-end self-stretch pb-2.5">
                  <div className="gav-hero-origem font-display font-bold leading-none tabular-nums" style={{ color: m > 0 ? tom((v / m) * 100, idealPct, true) : COLOR.mute }}>
                    {m > 0 ? fmtPct((v / m) * 100) : "—"}
                  </div>
                </div>,
              ];
            })}
          </div>
        </section>

          {/* Por BU: barras grossas — meta, realizado e quanto falta (26/11/2026). */}
          <section className="panel flex flex-col p-4 xl:col-span-5">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="eyebrow-label">Por BU</div>
              <LegendaBala comRitmo={false} />
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
                    marca={COR_BU[b]}
                    rotulo={BU_GESTAO_ROTULO[b]}
                    dica={real > 0 ? `Esta BU representa ${fmtPct((dados.porBu[b] / real) * 100)} da receita total do grupo educacional.` : undefined}
                    real={dados.porBu[b]}
                    meta={dados.metaPorBu[b]}
                    idealPct={idealPct}
                    altura={13}
                    falta
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
          <div className="flex items-center justify-between gap-3">
            <div className="eyebrow-label">Acumulado x ritmo da meta</div>
            <div className="flex items-center gap-3 text-[11px] text-white/45">
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-4 rounded" style={{ background: COLOR.gold }} />Acumulado</span>
              {temMeta && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: COLOR.warning }} />Ritmo</span>}
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2 rounded-sm" style={{ background: COLOR.gold, opacity: 0.35 }} />No dia</span>
            </div>
          </div>
          <div className="gav-grafico mt-2 h-[300px] max-sm:h-[240px]">
            <GavGrafico pontos={pontos} meta={meta} />
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
              <LegendaBala comRitmo={false} />
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
                altura={13}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
