"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { LigacaoRow } from "@/lib/data";
import { LIGACAO_STATUSES } from "@/lib/products";
import { fmtInt, fmtPct } from "@/lib/calc";

export default function LigacaoDonut({
  rows,
  title = "Origem das vendas (Onvox)",
}: {
  rows: LigacaoRow[];
  title?: string;
}) {
  const ordered = LIGACAO_STATUSES.map((s) => {
    const r = rows.find((x) => x.status === s.id);
    return { ...s, count: r?.count || 0, valor: r?.valor || 0 };
  });
  const total = ordered.reduce((a, b) => a + b.count, 0);

  if (total === 0) {
    return (
      <div className="card h-full grid place-items-center text-sm text-white/50 min-h-[180px]">
        Sem vendas no mes pra calcular origem.
      </div>
    );
  }

  return (
    <div className="card h-full">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-2">{title}</div>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 relative shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={ordered}
                dataKey="count"
                innerRadius={36}
                outerRadius={56}
                strokeWidth={0}
                paddingAngle={2}
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
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center leading-tight">
              <div className="text-lg font-bold">{fmtInt.format(total)}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">vendas</div>
            </div>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {ordered.map((o) => {
            const pct = total > 0 ? (o.count / total) * 100 : 0;
            return (
              <li key={o.id} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: o.color }}
                />
                <span className="text-white/70 flex-1 truncate text-xs">{o.short}</span>
                <span className="text-xs font-semibold" style={{ color: o.color }}>
                  {fmtPct(pct)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
