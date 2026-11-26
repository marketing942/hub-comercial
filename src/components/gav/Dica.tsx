"use client";
/**
 * Dica (tooltip) do GAV: um "i" pequeno ao lado do nome que abre um balao ao
 * TOCAR (TV/celular) ou passar o mouse. Fecha ao tocar fora ou no ESC.
 * Usada para as fatias (% da receita total / % da BU), que sairam do lado do nome.
 */
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

export default function Dica({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberta(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta]);

  return (
    <span
      ref={ref}
      className="relative inline-flex shrink-0 items-center"
      // Hover so com MOUSE: no toque o navegador emula "mouseenter" antes do clique,
      // e abriria/fecharia na mesma hora.
      onPointerEnter={(e) => e.pointerType === "mouse" && setAberta(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setAberta(false)}
    >
      <button
        type="button"
        aria-label="Ver participacao na receita"
        onClick={(e) => {
          e.stopPropagation();
          setAberta((a) => !a);
        }}
        className="grid h-4 w-4 place-items-center rounded-full text-white/35 transition hover:text-accent focus-visible:text-accent"
      >
        <Info className="h-3 w-3" />
      </button>
      {aberta && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[16rem] -translate-x-1/2 rounded-md border border-[#4a4230] bg-[#14141b] px-2.5 py-1.5 text-left font-sans text-[11.5px] font-normal normal-case leading-snug tracking-normal text-white/85 shadow-xl"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
