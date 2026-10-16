"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { day: string; valor: number; qtd: number; leads?: number };

export default function DailySalesChart({
  data,
  color = "#c9ae7a",
  field = "valor",
  unit = "currency",
}: {
  data: Row[];
  color?: string;
  field?: "valor" | "qtd" | "leads";
  unit?: "currency" | "int";
}) {
  const gradId = `barGrad_${field}_${color.replace("#", "")}`;
  return (
    <div className="h-60 sm:h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, left: -8, right: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2d2c3a" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="day" stroke="#87847a" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#87847a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              unit === "currency"
                ? "R$ " + Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
                : Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(175,146,86,0.10)" }}
            contentStyle={{
              background: "#14141b",
              border: "1px solid #3b3524",
              borderRadius: 12,
              color: "#e8e4d9",
            }}
            formatter={(val: any) =>
              unit === "currency"
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(val))
                : Intl.NumberFormat("pt-BR").format(Number(val))
            }
            labelFormatter={(l) => `Dia ${l}`}
          />
          <Bar
            dataKey={field}
            fill={`url(#${gradId})`}
            radius={[6, 6, 0, 0]}
            style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
