import { COLOR } from "@/lib/brand";

// Celula de uma faixa de indicadores (estilo tabela): rotulo, valor grande e nota.
export default function Cell({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cell p-4 min-w-0">
      <div className="kpi-label leading-tight">{label}</div>
      <div
        className="mt-1.5 font-display font-bold leading-none truncate text-[clamp(1.25rem,1.7vw,1.75rem)]"
        style={{ color: tone || COLOR.neutral }}
      >
        {value}
      </div>
      {children && <div className="mt-2 text-[11px] leading-snug text-white/50">{children}</div>}
    </div>
  );
}
