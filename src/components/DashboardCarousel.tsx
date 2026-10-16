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
}: {
  slides: Slide[];
  intervalSec?: number;
  refreshMs?: number;
  periodNav?: React.ReactNode;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [full, setFull] = useState(false);
  const [now, setNow] = useState<string>("--:--");
  const [countdown, setCountdown] = useState(intervalSec);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // relogio
  useEffect(() => {
    const tick = () => {
      setNow(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    tick();
    const clk = setInterval(tick, 30_000);
    return () => clearInterval(clk);
  }, []);

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

  // rotacao automatica entre slides
  useEffect(() => {
    if (paused || slides.length < 2) return;
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
  }, [paused, intervalSec, slides.length, idx]);

  // fullscreen
  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-panel border border-border">
          {slides.map((s, i) => {
            const active = i === idx;
            return (
              <button
                key={s.key}
                onClick={() => jump(i)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
                  active ? "bg-accent text-black" : "text-white/60 hover:text-white"
                }`}
              >
                {s.label}
                {active && !paused && slides.length > 1 && (
                  <span className="text-[10px] opacity-70">{countdown}s</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {periodNav}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-panel border border-border text-xs">
            <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
            <span className="text-white/60">Atualizado em</span>
            <span className="font-semibold text-accent">{now}</span>
          </div>
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
            className="btn-ghost h-9 w-9 !p-0"
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
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`transition-opacity duration-500 ${
              i === idx ? "opacity-100" : "opacity-0 hidden"
            }`}
            aria-hidden={i !== idx}
          >
            {s.node}
          </div>
        ))}
      </div>

      <div className="text-center text-[11px] text-white/30">
        {slides.length > 1
          ? `Rotaciona entre ${slides.map((s) => s.label).join(" e ")} a cada ${intervalSec}s. Dados atualizam a cada ${Math.round(refreshMs / 1000)}s.`
          : `Atualiza sozinho a cada ${Math.round(refreshMs / 1000)}s.`}
      </div>
    </div>
  );
}
