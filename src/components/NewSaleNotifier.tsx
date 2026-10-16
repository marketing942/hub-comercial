"use client";
import { useEffect, useRef, useState } from "react";
import { Trophy, X, Wallet } from "lucide-react";
import { BRL } from "@/lib/calc";
import { playAirHorn } from "@/lib/airHorn";

type Sale = {
  id: string;
  sellerName: string;
  valor: number;
  createdAt: string;
};

type Toast = Sale & { closingAt: number };

const POLL_MS = 7_000;         // de quanto em quanto tempo busca
const SHOW_MS = 8_000;         // tempo visivel por notificacao (minimo de 7s)
const STORAGE_KEY = "hub_last_sale_notifier";

export default function NewSaleNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Guardamos em ref pra nao disparar re-fetch quando atualiza.
  const sinceRef = useRef<string>(initialSince());
  const seenRef = useRef<Set<string>>(new Set(loadSeenIds()));
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Flag: so comeca a tocar depois do primeiro gesto (politicas de
  // autoplay). Antes disso, usamos tudo visual apenas.
  const unlockedRef = useRef(false);

  // Unlock de audio no primeiro clique/tecla.
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      try {
        audioCtxRef.current =
          audioCtxRef.current ||
          new (window.AudioContext || (window as any).webkitAudioContext)();
        unlockedRef.current = true;
      } catch {}
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Polling.
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const url = `/api/sales/recent?since=${encodeURIComponent(sinceRef.current)}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const sales: Sale[] = Array.isArray(j.sales) ? j.sales : [];
        if (alive && sales.length > 0) {
          const fresh = sales.filter((s) => !seenRef.current.has(s.id));
          for (const s of fresh) seenRef.current.add(s.id);
          persistSeenIds(seenRef.current);
          if (fresh.length > 0) {
            // Toca uma vez por batch (nao 10x seguidas se vierem muitas)
            playAirHorn(audioCtxRef.current);
            pushToasts(fresh);
          }
        }
        if (typeof j.now === "string") sinceRef.current = j.now;
        try {
          localStorage.setItem(STORAGE_KEY, sinceRef.current);
        } catch {}
      } catch {
        // silencioso — proximo tick tenta de novo
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushToasts(items: Sale[]) {
    const now = Date.now();
    const closingAt = now + SHOW_MS;
    setToasts((prev) => {
      // Limita a fila a no maximo 4 visiveis.
      const next = [...prev, ...items.map((s) => ({ ...s, closingAt }))];
      return next.slice(-4);
    });
  }

  function remove(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // Auto-fecha quando expira.
  useEffect(() => {
    if (toasts.length === 0) return;
    const nextExpiry = Math.min(...toasts.map((t) => t.closingAt));
    const delay = Math.max(50, nextExpiry - Date.now());
    const id = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.closingAt > Date.now()));
    }, delay);
    return () => clearTimeout(id);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div
      className="pointer-events-auto w-[320px] rounded-2xl shadow-glow border overflow-hidden animate-in slide-in-from-right duration-200 cursor-pointer"
      style={{
        // Fundo translucido: o dashboard continua visivel por tras (com leve desfoque).
        background: "linear-gradient(135deg, rgba(175,146,86,0.20), rgba(17,17,21,0.55))",
        borderColor: "rgba(175,146,86,0.45)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      onClick={onClose}
      role="button"
      title="Fechar notificacao"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-success/25 text-success">
          <Trophy className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-success font-semibold">
            Nova venda!
          </div>
          <div className="text-sm font-bold text-white truncate">
            {toast.sellerName}
          </div>
          <div className="text-base font-extrabold text-success inline-flex items-center gap-1 mt-0.5">
            <Wallet className="w-3.5 h-3.5" />
            {BRL.format(toast.valor)}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 w-6 h-6 grid place-items-center rounded-md hover:bg-white/10 text-white/70 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Fechar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Barra de progresso visual */}
      <div
        className="h-1 bg-success/80"
        style={{
          animation: `sale-toast-countdown ${SHOW_MS}ms linear forwards`,
          transformOrigin: "left",
        }}
      />
      <style jsx global>{`
        @keyframes sale-toast-countdown {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}

// ===== Helpers =====

function initialSince(): string {
  // Em memoria: tenta o ultimo "now" salvo; senao, agora - 1min (nao
  // dispara notificacao retroativa quando o dashboard abre).
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return v;
  } catch {}
  return new Date(Date.now() - 60_000).toISOString();
}

function loadSeenIds(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY + ":ids");
    if (!v) return [];
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    // Mantem no maximo 500 ids pra nao crescer indefinido.
    return arr.slice(-500);
  } catch {
    return [];
  }
}

function persistSeenIds(set: Set<string>) {
  try {
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(STORAGE_KEY + ":ids", JSON.stringify(arr));
  } catch {}
}
