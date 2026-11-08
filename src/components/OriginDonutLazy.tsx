"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type OriginDonutType from "./OriginDonut";

// Rosca do Recharts em chunk separado (so o admin chega a ver): tira ~100 kB do
// carregamento inicial do Dashboard TV.
const Donut = dynamic(() => import("./OriginDonut"), {
  ssr: false,
  loading: () => <div className="card h-[168px] animate-pulse" aria-hidden />,
});

export default function OriginDonut(props: ComponentProps<typeof OriginDonutType>) {
  return <Donut {...props} />;
}
