export default function ProgressBar({
  value,
  color = "#c9ae7a",
  height = 10,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full rounded-full bg-white/[0.10] overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${v}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: v > 0 ? `0 0 12px ${color}66` : undefined,
          transition: "width 500ms ease",
        }}
      />
    </div>
  );
}
