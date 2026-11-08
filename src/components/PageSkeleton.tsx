// Esqueleto exibido pelo Next (loading.tsx) enquanto a pagina do servidor carrega:
// a barra do topo/menu ja esta na tela e a navegacao responde na hora, em vez de
// ficar "travada" ate os dados chegarem. Tambem permite o prefetch do shell das rotas.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

export default function PageSkeleton({ kind = "panels" }: { kind?: "panels" | "table" | "split" }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-72 max-w-full" />
      </div>
      {kind === "split" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="panel p-4 xl:col-span-5 space-y-3">
            <Bar className="h-5 w-32" />
            <Bar className="h-12 w-3/4" />
            <Bar className="h-2 w-full" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Bar key={i} className="h-16" />
              ))}
            </div>
          </div>
          <div className="panel p-4 xl:col-span-7 min-h-[320px]">
            <Bar className="h-5 w-40 mb-4" />
            <Bar className="h-64 w-full" />
          </div>
        </div>
      ) : kind === "table" ? (
        <div className="panel p-4 space-y-3">
          <Bar className="h-9 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-4 space-y-3">
              <Bar className="h-5 w-32" />
              <Bar className="h-10 w-2/3" />
              <Bar className="h-3 w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
