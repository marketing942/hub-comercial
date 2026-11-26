"use client";
import dynamic from "next/dynamic";

// Recharts em chunk separado e so no navegador (ver CLAUDE.md §6.3).
const GavGrafico = dynamic(() => import("./GavGrafico"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.03]" />,
});

export default GavGrafico;
