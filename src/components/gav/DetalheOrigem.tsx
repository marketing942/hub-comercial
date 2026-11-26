"use client";
/**
 * Bloco clicavel do GAV que abre um modal de detalhes (hoje: origem "Direto",
 * que substituiu o antigo slide Direto). Enquanto o modal esta aberto o
 * carrossel segura a rotacao (evento `carrossel:segurar`), senao o slide
 * trocaria e o modal sumiria no meio da leitura.
 */
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export const EVENTO_SEGURAR = "carrossel:segurar";

export default function DetalheOrigem({
  titulo,
  gatilho,
  children,
  inline,
}: {
  titulo: string;
  gatilho: ReactNode;
  /** Gatilho pequeno, em linha com o texto (ex.: "detalhes ›"). */
  inline?: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_SEGURAR, { detail: aberto }));
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.dispatchEvent(new CustomEvent(EVENTO_SEGURAR, { detail: false }));
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title={`Ver detalhes: ${titulo}`}
        className={
          inline
            ? "inline-flex shrink-0 items-center rounded px-1 text-left"
            : "group -m-1.5 block w-[calc(100%+0.75rem)] min-w-0 rounded-lg p-1.5 text-left transition hover:bg-white/[0.04] focus-visible:bg-white/[0.04]"
        }
      >
        {gatilho}
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setAberto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md border border-border bg-panel p-4 shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="eyebrow-label">{titulo}</div>
              <button type="button" onClick={() => setAberto(false)} className="btn btn-ghost h-9 w-9 !p-0" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
