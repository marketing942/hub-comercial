export default function Avatar({
  name,
  url,
  color = "#c9ae7a",
  size = 40,
  className = "",
}: {
  name: string;
  url?: string | null;
  color?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className={`rounded-2xl object-cover bg-panel2 ${className}`}
        style={{
          width: size,
          height: size,
          boxShadow: `0 0 0 2px ${color}55`,
        }}
      />
    );
  }
  return (
    <div
      className={`rounded-2xl grid place-items-center font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: color + "33",
        color,
        fontSize: Math.round(size / 2.8),
      }}
    >
      {initials}
    </div>
  );
}
