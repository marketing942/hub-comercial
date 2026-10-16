import type { ReactNode } from "react";
import ProgressBar from "@/components/ProgressBar";

export default function BigStatCard({
  label,
  value,
  hint,
  icon,
  accent = "#c9ae7a",
  valueColor,
  progressPct,
  progressColor,
  progressFooter,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  valueColor?: string;
  // Quando passados, desenha barra de progresso dentro do card
  progressPct?: number;
  progressColor?: string;
  progressFooter?: ReactNode;
}) {
  return (
    <div className="card-lg card-hover relative overflow-hidden">
      <div className="relative flex flex-col gap-1">
        <div className="kpi-label leading-tight">{label}</div>
        <div className="big-num leading-none" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </div>
        {hint && <div className="text-[10px] text-white/50 leading-snug">{hint}</div>}
        {typeof progressPct === "number" && (
          <div>
            <ProgressBar value={progressPct} color={progressColor || accent} height={6} />
            {progressFooter && (
              <div className="text-[10px] text-white/55 mt-1 leading-snug">{progressFooter}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
