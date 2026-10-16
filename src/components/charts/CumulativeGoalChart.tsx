"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { day: string; pct: number; idealPct: number };

export default function CumulativeGoalChart({
  data,
  color = "#c9ae7a",
}: {
  data: Row[];
  color?: string;
}) {
  return (
    <div className="h-60 sm:h-64">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 16, left: -8, right: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2d2c3a" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="#87847a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#87847a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)]}
          />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.4 }}
            contentStyle={{
              background: "#14141b",
              border: "1px solid #3b3524",
              borderRadius: 12,
              color: "#e8e4d9",
            }}
            formatter={(val: any, name: any) => [
              `${Number(val).toFixed(1)}%`,
              name === "pct" ? "Realizado" : "Ideal",
            ]}
            labelFormatter={(l) => `Dia ${l}`}
          />
          <ReferenceLine y={100} stroke="#f0b44c" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="idealPct"
            stroke="#87847a"
            strokeDasharray="4 4"
            fill="transparent"
            strokeWidth={1.5}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="pct"
            stroke={color}
            strokeWidth={3}
            fill="url(#areaGrad)"
            style={{ filter: `drop-shadow(0 0 8px ${color}aa)` }}
            dot={false}
            activeDot={{ r: 5, stroke: "#0e0e14", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
