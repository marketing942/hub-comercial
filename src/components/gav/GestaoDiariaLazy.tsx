"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type GestaoDiariaType from "./GestaoDiaria";

// Recharts em chunk separado (so e medido no navegador).
const Chart = dynamic(() => import("./GestaoDiaria"), {
  ssr: false,
  loading: () => <div className="h-[300px] sm:h-[380px] w-full animate-pulse rounded-xl bg-white/[0.04]" aria-hidden />,
});

export default function GestaoDiaria(props: ComponentProps<typeof GestaoDiariaType>) {
  return <Chart {...props} />;
}
