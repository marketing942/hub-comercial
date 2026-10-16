import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "#c9ae7a",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="card card-hover">
      <div className="kpi-label">{label}</div>
      <div className="kpi-num mt-1">{value}</div>
      {hint && <div className="text-xs text-white/50 mt-1">{hint}</div>}
    </div>
  );
}
