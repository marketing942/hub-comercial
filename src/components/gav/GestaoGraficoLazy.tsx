"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type GestaoGraficoType from "./GestaoGrafico";

// Recharts em chunk separado (so e medido no navegador).
const Grafico = dynamic(() => import("./GestaoGrafico"), {
  ssr: false,
  loading: () => <div className="panel h-[420px] w-full animate-pulse" aria-hidden />,
});

export default function GestaoGrafico(props: ComponentProps<typeof GestaoGraficoType>) {
  return <Grafico {...props} />;
}
