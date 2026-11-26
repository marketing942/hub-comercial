import type { SellerStats } from "@/lib/calc";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";
import { BU_COLOR, BU_LABEL, COLOR, PANICO_BADGE } from "@/lib/brand";
import { isQtdPrimary, ALL_BUS, LIGACAO_STATUSES, INDICACAO_STATUSES, type BU } from "@/lib/products";
import ProgressBar from "@/components/ProgressBar";
import Avatar from "@/components/Avatar";
import { Crown } from "lucide-react";

type Status = "batido" | "quase" | "andamento" | "atrasado";

function statusFor(pct: number, gap: number): Status {
  if (pct >= 100) return "batido";
  if (pct >= 80) return "quase";
  if (gap > 0) return "atrasado";
  return "andamento";
}

const STATUS_META: Record<
  Status,
  { label: string; color: string; bg: string }
> = {
  batido: { label: "BATEU A META", color: COLOR.ok, bg: "rgba(95,208,143,0.18)" },
  quase: { label: "Quase la!", color: COLOR.warning, bg: "rgba(250,204,21,0.18)" },
  andamento: { label: "Em andamento", color: COLOR.info, bg: "rgba(125,211,252,0.18)" },
  atrasado: { label: "Recuperar ritmo", color: COLOR.danger, bg: "rgba(239,68,68,0.18)" },
};

export default function SellersGameView({
  stats,
  monthName,
  day,
  totalDays,
  daysLeft,
}: {
  stats: SellerStats[];
  monthName: string;
  day: number;
  totalDays: number;
  daysLeft: number;
}) {
  const sortByReal = (a: SellerStats, b: SellerStats) => b.realizado - a.realizado;

  const ranks: Record<BU, SellerStats[]> = {
    cppem: stats.filter((s) => s.bu === "cppem").sort(sortByReal),
    unicive: stats.filter((s) => s.bu === "unicive").sort(sortByReal),
    colegio_cppem: stats.filter((s) => s.bu === "colegio_cppem").sort(sortByReal),
  };

  // Podio so faz sentido se ha 2+ vendedores na BU
  const busWithPodium = ALL_BUS.filter((bu) => ranks[bu].length >= 2);

  return (
    <div className="space-y-2">
      {/* Podios apenas pra BUs com >= 2 vendedores */}
      {busWithPodium.length > 0 && (
        <section
          className={`grid grid-cols-1 gap-2 ${
            busWithPodium.length === 1
              ? ""
              : busWithPodium.length === 2
              ? "xl:grid-cols-2"
              : "xl:grid-cols-3"
          }`}
        >
          {busWithPodium.map((bu) => (
            <BUPodium
              key={bu}
              title={`Top 3 ${BU_LABEL[bu]}`}
              ranking={ranks[bu]}
              accent={BU_COLOR[bu]}
            />
          ))}
        </section>
      )}

      {/* Barra do Coordenador: meta agregada CPPEM + UNICIVE (so vendedores) */}
      <CoordinatorBar stats={stats} />

      {/* Progresso individual: UMA tabela das 3 BUs; a BU e a borda colorida da linha */}
      <SellersTable ranks={ranks} />
    </div>
  );
}

function CoordinatorBar({ stats }: { stats: SellerStats[] }) {
  // So considera CPPEM + UNICIVE (Colegio nao entra nessa barra) e apenas
  // valorRealizado/valorMeta de VENDEDORES — nao inclui direct_sales
  // nem vendas IA (que sao lancadas via /admin/direto).
  const relevant = stats.filter((s) => s.bu === "cppem" || s.bu === "unicive");
  const meta = relevant.reduce((a, s) => a + Number(s.valorMeta || 0), 0);
  const real = relevant.reduce((a, s) => a + Number(s.valorRealizado || 0), 0);
  const pct = meta > 0 ? (real / meta) * 100 : 0;
  const tone =
    meta <= 0 ? COLOR.mute : pct >= 100 ? COLOR.ok : pct >= 80 ? COLOR.warning : COLOR.danger;
  const falta = Math.max(0, meta - real);

  return (
    <section
      className="card-lg relative overflow-hidden"
      style={{ borderColor: tone + "55" }}
    >
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-[0.14] pointer-events-none"
        style={{ background: "#c9ae7a" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-white/50">
                Barra do Coordenador
              </div>
              <div className="text-sm font-semibold">
                Receita CPPEM + UNICIVE <span className="text-white/40 font-normal">(so vendedores)</span>
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl xl:text-4xl font-extrabold" style={{ color: tone }}>
              {BRL.format(real)}
            </span>
            <span className="text-white/30 text-xl xl:text-2xl font-bold">/</span>
            <span className="text-xl xl:text-2xl font-bold text-white/50">
              {BRL.format(meta)}
            </span>
            <span
              className="ml-2 px-2.5 py-1 rounded-lg text-sm font-bold"
              style={{ background: tone + "22", color: tone }}
            >
              {fmtPct(pct)}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={pct} color={tone} height={12} />
          <div className="text-[11px] mt-1.5 flex items-center gap-3 flex-wrap text-white/60">
            <span>
              Faltam <b className="text-white/85">{BRL.format(falta)}</b>
            </span>
            <span className="text-white/40">·</span>
            <span>
              {relevant.length} entrada{relevant.length === 1 ? "" : "s"}{" "}
              <span className="text-white/40">de vendedor x BU</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Colunas da tabela unica: # | vendedor | progresso | realizado | meta | ticket | conversao | leads | matriculas
const COLS =
  "grid-cols-[2rem_minmax(11rem,1.4fr)_minmax(9rem,1.3fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(6rem,.8fr)_minmax(5rem,.7fr)_4rem_4.5rem]";

function SellersTable({ ranks }: { ranks: Record<BU, SellerStats[]> }) {
  const head = "font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40";
  const grupos = ALL_BUS.filter((bu) => ranks[bu].length > 0);
  return (
    <section className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className={`grid ${COLS} items-center gap-3 border-b border-[var(--hair)] py-2 pl-4 pr-5 ${head}`}>
            <span>#</span>
            <span className="flex items-center gap-3">
              Vendedor
              <span className="flex items-center gap-2 normal-case tracking-normal font-normal">
                {ALL_BUS.map((bu) => (
                  <span key={bu} className="inline-flex items-center gap-1">
                    <i className="h-2.5 w-1 rounded-sm" style={{ background: BU_COLOR[bu] }} />
                    {BU_LABEL[bu]}
                  </span>
                ))}
              </span>
            </span>
            <span>Progresso</span>
            <span className="text-right">Realizado</span>
            <span className="text-right">Meta</span>
            <span className="text-right">Ticket</span>
            <span className="text-right">Conversao</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Matric.</span>
          </div>
          {grupos.map((bu, gi) =>
            ranks[bu].map((s, i) => (
              <SellerRow
                key={`${s.sellerId}_${s.bu}`}
                s={s}
                pos={i + 1}
                accent={BU_COLOR[bu]}
                inicioGrupo={i === 0 && gi > 0}
              />
            )),
          )}
        </div>
      </div>
    </section>
  );
}

function SellerRow({ s, pos, accent, inicioGrupo }: { s: SellerStats; pos: number; accent: string; inicioGrupo: boolean }) {
  const isQtd = isQtdPrimary(s.bu);
  const fmtP = (n: number) => (isQtd ? `${fmtInt.format(Math.round(n))} mat.` : BRL.format(n));
  const st = statusFor(s.pctSucesso, s.gap);
  const meta = STATUS_META[st];
  const ticketTone = s.ticketMeta > 0 ? (s.ticketReal >= s.ticketMeta ? COLOR.ok : COLOR.danger) : COLOR.neutral;
  const convTone = s.conversaoMeta > 0 ? (s.conversaoReal >= s.conversaoMeta ? COLOR.ok : COLOR.danger) : COLOR.neutral;
  const sub = "text-[10px] text-white/40";
  return (
    <div
      className={`grid ${COLS} items-center gap-3 py-2 pl-3 pr-5 hover:bg-white/[0.02] transition ${
        inicioGrupo ? "border-t-2 border-white/10" : "border-t border-[var(--hair)] first:border-t-0"
      }`}
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <span className="font-display font-bold text-white/35">{pos}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative shrink-0">
          <Avatar name={s.sellerName} url={s.avatarUrl} color={s.avatarColor || accent} size={30} />
          {st === "atrasado" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={PANICO_BADGE}
              alt="Bata a meta ou sera abatido"
              title="Bata a meta ou sera abatido"
              className="absolute -top-3 -right-4 w-6 h-6 object-contain rotate-[14deg] pointer-events-none select-none"
            />
          )}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold truncate">{s.sellerName}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
            {meta.label}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-14 shrink-0 font-display font-bold tabular-nums" style={{ color: meta.color }}>
          {fmtPct(s.pctSucesso)}
        </span>
        <div className="flex-1 min-w-0">
          <ProgressBar value={s.pctSucesso} color={meta.color} height={5} />
        </div>
      </div>
      <div className="text-right text-sm font-semibold tabular-nums truncate">{fmtP(s.realizado)}</div>
      <div className="text-right text-sm tabular-nums text-white/60 truncate">{fmtP(s.metaTotal)}</div>
      <div className="text-right leading-tight tabular-nums">
        <div className="text-sm font-semibold" style={{ color: ticketTone }}>{BRL.format(s.ticketReal)}</div>
        <div className={sub}>{s.ticketMeta > 0 ? `meta ${BRL.format(s.ticketMeta)}` : "sem meta"}</div>
      </div>
      <div className="text-right leading-tight tabular-nums">
        <div className="text-sm font-semibold" style={{ color: convTone }}>{fmtPct(s.conversaoReal)}</div>
        <div className={sub}>{s.conversaoMeta > 0 ? `meta ${fmtPct(s.conversaoMeta)}` : "sem meta"}</div>
      </div>
      <div className="text-right text-sm font-semibold tabular-nums">{fmtInt.format(s.leads)}</div>
      <div className="text-right text-sm font-semibold tabular-nums">
        {s.bu === "cppem" ? <span className="text-white/25">—</span> : fmtInt.format(s.qtdRealizada)}
      </div>
    </div>
  );
}

// Podio de verdade: 2o | 1o | 3o, com pilares de alturas diferentes. O vendedor
// fica em cima do pilar (avatar + nome) e os numeros ficam dentro do pilar.
const PODIUM_STYLE: Record<
  number,
  { height: number; fill: string; edge: string; num: string }
> = {
  1: {
    height: 210,
    fill: "linear-gradient(180deg, rgba(201,174,122,0.55), rgba(175,146,86,0.18))",
    edge: "#e6cf9f",
    num: "#f0dcb0",
  },
  2: {
    height: 160,
    fill: "linear-gradient(180deg, rgba(190,190,205,0.34), rgba(190,190,205,0.08))",
    edge: "#c4c4d0",
    num: "#d6d6e0",
  },
  3: {
    height: 128,
    fill: "linear-gradient(180deg, rgba(190,130,85,0.40), rgba(190,130,85,0.09))",
    edge: "#c98f5e",
    num: "#dba978",
  },
};

function BUPodium({
  title,
  ranking,
  accent,
}: {
  title: string;
  ranking: SellerStats[];
  accent: string;
}) {
  const top3 = ranking.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="card-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold font-display uppercase tracking-wide" style={{ color: accent }}>
          {title}
        </div>
        <div className="text-[11px] text-white/40">{ranking.length} no time</div>
      </div>
      {order.length === 0 ? (
        <div className="text-sm text-white/50 py-6 text-center">Sem vendedores nesta BU ainda.</div>
      ) : (
        <div>
          <div className="flex items-end justify-center gap-2 sm:gap-3">
            {order.map((s) => {
              const pos = ranking.indexOf(s) + 1;
              const isFirst = pos === 1;
              const st = PODIUM_STYLE[pos];
              const isQtd = isQtdPrimary(s.bu);
              const valueStr = isQtd ? fmtInt.format(s.realizado) : BRL.format(s.realizado);
              const label = isQtd ? "matriculas" : "faturado";
              return (
                <div key={`${s.sellerId}_${s.bu}`} className="flex-1 min-w-0 max-w-[190px] flex flex-col items-center">
                  {/* Vendedor em cima do pilar */}
                  <div className="relative flex justify-center mb-1.5">
                    {isFirst && (
                      <Crown
                        className="absolute -top-5 left-1/2 w-7 h-7"
                        style={{
                          color: "#e6cf9f",
                          filter: "drop-shadow(0 2px 8px rgba(201,174,122,0.6))",
                          transform: "translateX(-50%) rotate(-8deg)",
                        }}
                      />
                    )}
                    <Avatar
                      name={s.sellerName}
                      url={s.avatarUrl}
                      color={s.avatarColor || accent}
                      size={isFirst ? 68 : 54}
                    />
                  </div>
                  <div
                    className={`w-full text-center font-semibold truncate mb-2 ${isFirst ? "text-base" : "text-sm"}`}
                    style={isFirst ? { color: st.num } : undefined}
                    title={s.sellerName}
                  >
                    {s.sellerName}
                  </div>

                  {/* Pilar com os dados */}
                  <div
                    className="w-full rounded-t-xl flex flex-col items-center justify-start px-2 pt-2.5 pb-2 text-center"
                    style={{
                      height: st.height,
                      background: st.fill,
                      borderTop: `2px solid ${st.edge}`,
                      boxShadow: isFirst ? "0 -10px 40px -14px rgba(201,174,122,0.55)" : undefined,
                    }}
                  >
                    <div className="font-display font-bold leading-none" style={{ fontSize: isFirst ? 40 : 30, color: st.num }}>
                      {pos}
                    </div>
                    <div className="mt-2 text-sm xl:text-base font-bold text-white truncate max-w-full">
                      {valueStr}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
                    <div
                      className="mt-1 text-[11px] font-semibold"
                      style={{ color: s.pctSucesso >= 100 ? COLOR.ok : COLOR.neutral }}
                    >
                      {fmtPct(s.pctSucesso)} da meta
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-1.5 rounded-b-md bg-white/10" />
        </div>
      )}
    </div>
  );
}
