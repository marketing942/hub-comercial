"use client";

import { useEffect, useRef } from "react";

// Mira de arma no lugar do cursor — só quando há mouse (ponteiro fino com hover).
// Em celular/tablet (toque) nada muda. Respeita o mouse: sem atraso, a mira é o próprio ponteiro.
const INTERACTIVE = "a, button, summary, label, [role='button']";

export function Crosshair() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const root = document.documentElement;
    let x = 0;
    let y = 0;
    let frame = 0;
    let fireTimer = 0;

    const paint = () => {
      frame = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const enable = () => {
      root.classList.add("has-crosshair");
      el.classList.add("is-on");
    };
    const disable = () => {
      root.classList.remove("has-crosshair");
      el.classList.remove("is-on", "is-lock", "is-fire");
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") {
        disable(); // toque/caneta num aparelho híbrido: volta ao ponteiro normal
        return;
      }
      x = e.clientX;
      y = e.clientY;
      enable();
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target as Element | null;
      el.classList.toggle("is-lock", !!target?.closest?.(INTERACTIVE));
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      el.classList.add("is-fire");
      window.clearTimeout(fireTimer);
      fireTimer = window.setTimeout(() => el.classList.remove("is-fire"), 140);
    };

    const onLeave = () => el.classList.remove("is-on");

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fireTimer);
      disable();
    };
  }, []);

  return (
    <div ref={ref} className="crosshair" aria-hidden>
      <svg className="crosshair-art" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="28" cy="28" r="16" />
        <path d="M28 3v13M28 40v13M3 28h13M40 28h13" />
        <circle cx="28" cy="28" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}
