"use client";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { BRL, fmtInt, fmtPct } from "@/lib/calc";

export type OriginRow = { status: string; count: number; valor: number };
export type OriginStatus = { id: string; label: string; short: string; color: string };

const SIZE = 128;

export default function OriginDonut({
  rows,
  statuses,
  title,
  subtitle,
}: {
  rows: OriginRow[];
  statuses: readonly OriginStatus[];
  title: string;
  subtitle?: string;
}) {
  const ordered = statuses.map((s) => {
    const r = rows.find((x) => x.status === s.id);
    return { ...s, count: r?.count || 0, valor: r?.valor || 0 };
  });
  const total = ordered.reduce((a, b) => a + b.count, 0);
  const totalValor = ordered.reduce((a, b) => a + b.valor, 0);

  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wider text-white/50">{title}</div>
      {subtitle && (
        <div className="text-[11px] text-white/40 mt-0.5 mb-2">{subtitle}</div>
      )}

      {total === 0 ? (
        <div className="text-sm text-white/50 grid place-items-center h-32 mt-2">
          Sem vendas no mes pra calcular origem.
        </div>
      ) : (
        <div className="flex items-center gap-4 mt-2">
          <div
            className="relative shrink-0"
            style={{ width: SIZE, height: SIZE }}
          >
            <PieChart width={SIZE} height={SIZE}>
              <Pie
                data={ordered}
                dataKey="count"
                cx={SIZE / 2}
                cy={SIZE / 2}
                innerRadius={36}
                outerRadius={56}
                strokeWidth={0}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {ordered.map((o) => (
                  <Cell key={o.id} fill={o.color} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                contentStyle={{
                  background: "#14141b",
                  border: "1px solid #3b3524",
                  borderRadius: 10,
                  color: "#e8e4d9",
                  fontSize: 12,
                }}
                formatter={(val: any, _name: any, props: any) => [
                  `${fmtInt.format(Number(val))} venda${Number(val) === 1 ? "" : "s"}`,
                  props?.payload?.short,
                ]}
              />
            </PieChart>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center leading-tight">
                <div className="text-lg font-bold">{fmtInt.format(total)}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">vendas</div>
              </div>
            </div>
          </div>

          <ul className="flex-1 space-y-2 text-sm min-w-0">
            {ordered.map((o) => {
              const pct = total > 0 ? (o.count / total) * 100 : 0;
              return (
                <li key={o.id} className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                    style={{ background: o.color }}
                  />
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-white/70 truncate">{o.short}</span>
                      <span className="text-xs font-semibold" style={{ color: o.color }}>
                        {fmtPct(pct)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/50">
                      <span>{fmtInt.format(o.count)} venda{o.count === 1 ? "" : "s"}</span>
                      <span className="text-white/40">{BRL.format(o.valor)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {total > 0 && (
        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-white/50">
          <span>Total faturado</span>
          <span className="font-semibold text-white">{BRL.format(totalValor)}</span>
        </div>
      )}
    </div>
  );
}
