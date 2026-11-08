"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type UnifiedDailyChartType from "./UnifiedDailyChart";

export type { UnifiedChartRow, UnifiedChartSeries } from "./UnifiedDailyChart";

// O Recharts pesa ~100 kB e o grafico so e medido no navegador (ResponsiveContainer),
// entao nao ha ganho em renderiza-lo no servidor: carrega em chunk separado e o resto
// da tela (numeros, cartoes) aparece e fica interativo antes.
const Chart = dynamic(() => import("./UnifiedDailyChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] sm:h-[360px] w-full animate-pulse rounded-xl bg-white/[0.04]" aria-hidden />
  ),
});

export default function UnifiedDailyChart(props: ComponentProps<typeof UnifiedDailyChartType>) {
  return <Chart {...props} />;
}
