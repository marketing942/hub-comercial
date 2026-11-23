"use client";

/**
 * Mês a mês de vendas: barras por mês, empilhadas por BU.
 *
 * ## Por que barra empilhada, e não linha nem três gráficos
 *
 * A pergunta é de MAGNITUDE por período fechado ("quanto entrou em cada mês"),
 * e mês é categoria ordenada, não contínuo — por isso barra, não linha. O
 * empilhamento por BU entrega, de graça, a segunda pergunta que sempre vem
 * junto ("de onde veio"), sem um segundo gráfico ao lado.
 *
 * Um eixo só, em reais. Nunca um segundo eixo com quantidade: duas escalas no
 * mesmo desenho fazem o leitor comparar alturas que não são comparáveis.
 *
 * ## A cor é da BU, nunca do ranking
 *
 * As cores vêm de `BU_COLOR`, as mesmas do resto do app. Um mês em que a
 * Unicive passa o CPPEM não pode trocar as cores de lugar — senão a leitura
 * de um mês contamina a do seguinte. E como dourado (CPPEM) e amarelo
 * (Unicive) são vizinhos de matiz, a identidade NUNCA depende só da cor: a
 * legenda está sempre presente, e tanto a tooltip quanto o pop-up escrevem o
 * nome da BU ao lado do valor.
 *
 * ## Passar o mouse mostra; clicar aprofunda
 *
 * A tooltip responde "quanto, e de quem" sem tirar a mão do mouse. O clique
 * abre o pop-up, que é onde cabe o resto: vendedores, categorias, melhor dia,
 * ticket, variação. Tudo isso já veio do servidor junto com o resumo, então o
 * pop-up abre instantâneo — clicar não busca nada.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BU_COLOR, BU_LABEL, COLOR } from "@/lib/brand";
import type { BU } from "@/lib/products";
import { MES_CURTO, MES_NOME } from "@/lib/vendasMesTipos";
import type { MesResumo, VendasAno } from "@/lib/vendasMesTipos";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** "R$ 90,9 mil" — só para o rótulo em cima da barra, onde não cabe o valor cheio. */
const curto = (v: number) => {
  if (v === 0) return "";
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

/** Ordem FIXA das BUs. Nunca ordenar por valor: a posição da pilha é identidade. */
const BUS: BU[] = ["cppem", "unicive", "colegio_cppem"];

/** "2026-11-23" → "23/11". Sem `new Date()`: a string já está no fuso certo. */
function dia(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

type LinhaGrafico = {
  mes: number;
  nome: string;
  total: number;
  cppem: number;
  unicive: number;
  colegio_cppem: number;
};

export default function VendasMesAMes({ dados }: { dados: VendasAno }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<MesResumo | null>(null);

  // Fechar com Esc é o mínimo de um pop-up: quem abriu sem querer sai sem
  // caçar o X, e quem usa teclado não fica preso dentro do diálogo.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  const linhas: LinhaGrafico[] = dados.meses.map((m) => ({
    mes: m.mes,
    nome: MES_CURTO[m.mes - 1],
    total: m.valor,
    cppem: m.porBu.cppem,
    unicive: m.porBu.unicive,
    colegio_cppem: m.porBu.colegio_cppem,
  }));

  const comValor = dados.meses.filter((m) => m.valor > 0);
  const media = comValor.length > 0 ? dados.total / comValor.length : 0;
  const melhor = comValor.reduce<MesResumo | null>((a, m) => (!a || m.valor > a.valor ? m : a), null);

  function abrirMes(indice: number | undefined) {
    if (indice === undefined || indice < 0 || indice >= dados.meses.length) return;
    const m = dados.meses[indice];
    // Mês sem venda não tem o que detalhar — abrir um pop-up vazio é pior do
    // que o clique não responder.
    if (m.valor <= 0) return;
    setAberto(m);
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Mes a mes de {dados.year}</div>
            <div className="text-xs text-white/50">
              Passe o mouse para ver o mes. Clique numa barra para abrir o detalhe.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-right">
            <Kpi rotulo="Total do ano" valor={BRL(dados.total)} />
            <Kpi rotulo="Media mensal" valor={BRL(media)} />
            {melhor && <Kpi rotulo="Melhor mes" valor={`${MES_CURTO[melhor.mes - 1]} · ${BRL(melhor.valor)}`} />}
          </div>
        </div>

        {/* Legenda sempre presente: com 3 series, identidade nunca pode depender
            so da cor — ainda mais com dourado e amarelo lado a lado. */}
        <div className="mb-3 flex flex-wrap items-center gap-4">
          {BUS.map((bu) => (
            <span key={bu} className="inline-flex items-center gap-1.5 text-xs text-white/60">
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BU_COLOR[bu] }} />
              {BU_LABEL[bu]}
            </span>
          ))}
        </div>

        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <BarChart
              data={linhas}
              margin={{ top: 24, right: 8, bottom: 4, left: 8 }}
              onClick={(estado: { activeTooltipIndex?: number }) => abrirMes(estado?.activeTooltipIndex)}
            >
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="nome"
                tick={{ fill: "#ada99b", fontSize: 12 }}
                axisLine={{ stroke: "#ffffff14" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#ada99b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(v: number) => curto(Number(v))}
              />
              <Tooltip
                cursor={{ fill: "#ffffff08" }}
                content={<TooltipMes meses={dados.meses} />}
              />
              {BUS.map((bu, i) => (
                <Bar
                  key={bu}
                  dataKey={bu}
                  stackId="bu"
                  fill={BU_COLOR[bu]}
                  // 2px de respiro entre os pedaços da pilha: sem isso, duas
                  // cores vizinhas viram um bloco só e some a divisão.
                  stroke="#0d0d12"
                  strokeWidth={2}
                  cursor="pointer"
                  radius={i === BUS.length - 1 ? [4, 4, 0, 0] : undefined}
                  isAnimationActive={false}
                >
                  {/* Valor so no topo da pilha, uma vez por mes. Numero em toda
                      fatia viraria ruido e tornaria o grafico ilegivel. */}
                  {i === BUS.length - 1 && (
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(v: number) => curto(Number(v))}
                      style={{ fill: "#ada99b", fontSize: 10 }}
                    />
                  )}
                  {linhas.map((l) => (
                    <Cell key={l.mes} opacity={l.mes === dados.mesSelecionado ? 1 : 0.78} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {aberto && (
        <PopupMes
          mes={aberto}
          year={dados.year}
          selecionado={aberto.mes === dados.mesSelecionado}
          onFechar={() => setAberto(null)}
          onVerVendas={() => {
            router.push(`/admin/gav/vendas?year=${dados.year}&mes=${aberto.mes}`);
            setAberto(null);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{rotulo}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{valor}</div>
    </div>
  );
}

// ---------------------------------------------------------------- tooltip

function TooltipMes({
  active,
  payload,
  meses,
}: {
  active?: boolean;
  payload?: { payload: LinhaGrafico }[];
  meses: MesResumo[];
}) {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload;
  const m = meses[linha.mes - 1];
  if (!m) return null;

  return (
    <div
      style={{
        background: "#14141b",
        border: "1px solid #4a4230",
        borderRadius: 12,
        padding: "10px 12px",
        fontSize: 12,
        minWidth: 220,
        boxShadow: "0 18px 50px rgba(0,0,0,.55)",
      }}
    >
      <div
        style={{
          color: COLOR.gold,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          fontSize: 11,
        }}
      >
        {MES_NOME[m.mes - 1]}
      </div>
      <div style={{ color: "#e8e4d9", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{BRL(m.valor)}</div>

      {m.valor > 0 && (
        <>
          {BUS.filter((bu) => m.porBu[bu] > 0).map((bu) => (
            <div key={bu} style={{ display: "flex", justifyContent: "space-between", gap: 18, marginTop: 4 }}>
              <span style={{ color: "#ada99b", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i style={{ width: 8, height: 8, borderRadius: 2, background: BU_COLOR[bu], display: "inline-block" }} />
                {BU_LABEL[bu]}
              </span>
              <b style={{ color: "#e8e4d9", fontWeight: 600 }}>{BRL(m.porBu[bu])}</b>
            </div>
          ))}
          <div
            style={{
              marginTop: 8,
              paddingTop: 7,
              borderTop: "1px solid #3b3524",
              color: "#ada99b",
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <span>
              {m.vendas} venda{m.vendas === 1 ? "" : "s"}
            </span>
            {m.variacao !== null && (
              <b style={{ color: m.variacao >= 0 ? COLOR.ok : COLOR.danger }}>
                {m.variacao >= 0 ? "+" : ""}
                {m.variacao.toFixed(1)}% vs mes anterior
              </b>
            )}
          </div>
          <div style={{ marginTop: 6, color: "#6f6b60", fontSize: 11 }}>Clique para o detalhe</div>
        </>
      )}
      {m.valor === 0 && <div style={{ color: "#6f6b60", marginTop: 4 }}>Sem venda neste mes</div>}
    </div>
  );
}

// ------------------------------------------------------------------ pop-up

function PopupMes({
  mes,
  year,
  selecionado,
  onFechar,
  onVerVendas,
}: {
  mes: MesResumo;
  year: number;
  selecionado: boolean;
  onFechar: () => void;
  onVerVendas: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhe de ${MES_NOME[mes.mes - 1]} de ${year}`}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-border bg-panel p-5 sm:rounded-2xl"
        // Clicar DENTRO do pop-up não pode fechá-lo: sem isto, selecionar um
        // texto e soltar o mouse fora fecharia a janela no meio da leitura.
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow-label">
              {MES_NOME[mes.mes - 1]} de {year}
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{BRL(mes.valor)}</div>
            {mes.variacao !== null && (
              <div
                className="mt-0.5 text-sm font-semibold tabular-nums"
                style={{ color: mes.variacao >= 0 ? COLOR.ok : COLOR.danger }}
              >
                {mes.variacao >= 0 ? "+" : ""}
                {mes.variacao.toFixed(1)}% em relacao ao mes anterior
              </div>
            )}
          </div>
          <button className="btn-ghost text-xs" onClick={onFechar} aria-label="Fechar">
            Fechar
          </button>
        </header>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Caixa rotulo="Vendas" valor={String(mes.vendas)} />
          <Caixa rotulo="Unidades" valor={String(mes.unidades)} />
          <Caixa rotulo="Ticket medio" valor={BRL(mes.ticket)} />
          <Caixa
            rotulo="Melhor dia"
            valor={mes.melhorDia ? `${dia(mes.melhorDia.data)} · ${BRL(mes.melhorDia.valor)}` : "—"}
          />
        </div>

        <Bloco titulo="Por unidade de negocio">
          {BUS.filter((bu) => mes.porBu[bu] > 0).map((bu) => (
            <Barra
              key={bu}
              rotulo={BU_LABEL[bu]}
              valor={mes.porBu[bu]}
              total={mes.valor}
              cor={BU_COLOR[bu]}
            />
          ))}
        </Bloco>

        <Bloco titulo="Por vendedor">
          {mes.porVendedor.map((f) => (
            <Barra key={f.chave} rotulo={f.rotulo} valor={f.valor} total={mes.valor} cor={COLOR.gold} extra={`${f.vendas}x`} />
          ))}
        </Bloco>

        <Bloco titulo="Por categoria">
          {mes.porCategoria.map((f) => (
            <Barra key={f.chave} rotulo={f.rotulo} valor={f.valor} total={mes.valor} cor={COLOR.info} extra={`${f.vendas}x`} />
          ))}
        </Bloco>

        <button className="btn-primary mt-5 w-full text-sm" onClick={onVerVendas} disabled={selecionado}>
          {selecionado
            ? `As vendas de ${MES_NOME[mes.mes - 1]} ja estao abertas abaixo`
            : `Ver as ${mes.vendas} vendas de ${MES_NOME[mes.mes - 1]}`}
        </button>
      </div>
    </div>
  );
}

function Caixa({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-panel2/60 p-3 leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{rotulo}</div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums">{valor}</div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="eyebrow-label mb-2">{titulo}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Barra({
  rotulo,
  valor,
  total,
  cor,
  extra,
}: {
  rotulo: string;
  valor: number;
  total: number;
  cor: string;
  extra?: string;
}) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-white/70">{rotulo}</span>
        <span className="shrink-0 tabular-nums">
          {extra && <span className="mr-2 text-white/30">{extra}</span>}
          <b className="font-semibold">{BRL(valor)}</b>
          <span className="ml-2 text-white/35">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: cor }} />
      </div>
    </div>
  );
}
