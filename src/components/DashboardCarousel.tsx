"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, Pause, Play, RefreshCw } from "lucide-react";

type Slide = { key: string; label: string; node: React.ReactNode };

export default function DashboardCarousel({
  slides,
  intervalSec = 20,
  refreshMs = 60000,
  periodNav,
  sync,
}: {
  slides: Slide[];
  intervalSec?: number;
  refreshMs?: number;
  periodNav?: React.ReactNode;
  /** Ultimo envio do Conta Azul (via Jarvis) que chegou ao Hub: `ca_sync.vendas`. */
  sync?: { em: string | null; erro: string | null; link?: string };
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [full, setFull] = useState(false);
  const [countdown, setCountdown] = useState(intervalSec);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // auto-refresh dos dados — so com a aba visivel. Ao voltar pra aba, atualiza
  // na hora se os dados ja estiverem velhos.
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      router.refresh();
    };
    refreshRef.current = setInterval(() => {
      if (!document.hidden) refresh();
    }, refreshMs);
    const onVisible = () => {
      if (!document.hidden && Date.now() - last >= refreshMs) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, refreshMs]);

  // Um modal aberto dentro do slide (ex.: detalhe do Direto no GAV) segura a rotacao.
  const [segurando, setSegurando] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setSegurando(!!(e as CustomEvent).detail);
    window.addEventListener("carrossel:segurar", on);
    return () => window.removeEventListener("carrossel:segurar", on);
  }, []);

  // rotacao automatica entre slides
  useEffect(() => {
    if (paused || segurando || slides.length < 2) return;
    setCountdown(intervalSec);
    cdRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setIdx((i) => (i + 1) % slides.length);
          return intervalSec;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (cdRef.current) clearInterval(cdRef.current);
    };
  }, [paused, segurando, intervalSec, slides.length, idx]);

  // fullscreen
  useEffect(() => {
    // Vale tambem para sair pelo ESC: o modo TV acompanha a tela cheia de verdade.
    const onFs = () => {
      const on = !!document.fullscreenElement;
      setFull(on);
      document.documentElement.classList.toggle("tv-mode", on);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFull() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      document.documentElement.classList.add("tv-mode");
    } else {
      await document.exitFullscreen?.();
      document.documentElement.classList.remove("tv-mode");
    }
  }

  function jump(i: number) {
    setIdx(i);
    setCountdown(intervalSec);
  }

  return (
    <div className="space-y-5">
      {/* Barra de contexto: abas em pilula (douradas, compactas) + periodo e acoes */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="inline-flex max-w-full items-center gap-0.5 self-start overflow-x-auto no-scrollbar rounded-xl border border-border bg-panel p-1">
          {slides.map((s, i) => {
            const active = i === idx;
            return (
              <button
                key={s.key}
                onClick={() => jump(i)}
                className={`relative shrink-0 overflow-hidden rounded-lg px-3 py-1.5 font-ui text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition ${
                  active ? "bg-accent text-black" : "text-white/55 hover:text-white"
                }`}
              >
                {s.label}
                {/* tempo ate a proxima aba */}
                {active && !paused && slides.length > 1 && (
                  <span
                    className="absolute left-0 bottom-0 h-[2px] bg-black/35"
                    style={{ width: `${(countdown / intervalSec) * 100}%`, transition: "width 1s linear" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {periodNav}
          <SyncStatus sync={sync} />
          {slides.length > 1 && (
            <button
              className="btn-ghost h-9 w-9 !p-0"
              onClick={() => setPaused((p) => !p)}
              title={paused ? "Retomar rotacao automatica" : "Pausar rotacao"}
              aria-label={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
          <button
            className="btn-ghost h-9 w-9 !p-0"
            onClick={() => router.refresh()}
            title="Atualizar agora"
            aria-label="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            className="btn-ghost h-9 w-9 !p-0 max-sm:hidden"
            onClick={toggleFull}
            title={full ? "Sair de tela cheia" : "Tela cheia (TV)"}
            aria-label="Tela cheia"
          >
            {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Slides */}
      <div className="relative">
        {/* Monta so o slide ativo: antes todos ficavam montados (escondidos) e cada um
            rodava o proprio grafico/medicoes em segundo plano. */}
        {slides.map((s, i) =>
          i === idx ? (
            <div key={s.key} className="animate-in fade-in duration-500">
              {s.node}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/**
 * Quando o Conta Azul ENVIOU dado pela ultima vez (o Jarvis empurra a cada ~15
 * min para /api/ca/receber). NAO e o relogio da tela: atualizar a pagina nao
 * muda este horario. Verde = envio recente; amarelo = mais de 40 min sem envio;
 * vermelho = o ultimo envio falhou.
 */
function SyncStatus({ sync }: { sync?: { em: string | null; erro: string | null; link?: string } }) {
  if (!sync) return null;
  const quando = sync.em ? new Date(sync.em) : null;
  const minutos = quando ? (Date.now() - quando.getTime()) / 60000 : Infinity;
  const hoje = quando && quando.toLocaleDateString("pt-BR", { timeZone: "America/Recife" }) === new Date().toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
  const hora = quando
    ? quando.toLocaleString("pt-BR", {
        timeZone: "America/Recife",
        hour: "2-digit",
        minute: "2-digit",
        ...(hoje ? {} : { day: "2-digit", month: "2-digit" }),
      })
    : "nunca";
  const cor = sync.erro ? "#ee7d73" : minutos > 40 ? "#f0b44c" : "#5fd08f";
  const corpo = (
    <>
      <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: cor }} />
      <span className="text-white/50">{sync.erro ? "Envio falhou" : "Conta Azul"}</span>
      <span className="font-semibold tabular-nums" style={{ color: cor }}>{hora}</span>
    </>
  );
  const titulo = sync.erro
    ? `Ultimo envio do Conta Azul falhou: ${sync.erro}`
    : "Horario do ultimo envio de dados do Conta Azul para o Hub (nao e o horario da tela)";
  const cls = "hidden sm:flex items-center gap-2 px-2 py-1.5 text-xs";
  return sync.link ? (
    <a href={sync.link} title={titulo} className={`${cls} rounded-lg hover:bg-white/5`}>{corpo}</a>
  ) : (
    <div title={titulo} className={cls}>{corpo}</div>
  );
}
