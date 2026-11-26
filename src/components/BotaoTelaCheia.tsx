"use client";
/**
 * Botao de tela cheia (modo TV): entra/sai do fullscreen e liga `html.tv-mode`
 * (esconde a barra do topo e compacta — ver globals.css). Usado no carrossel da
 * Gestao a Vista e no Meu Painel do vendedor. Escondido no celular.
 */
import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export default function BotaoTelaCheia() {
  const [full, setFull] = useState(false);

  useEffect(() => {
    // Vale tambem para sair pelo ESC: o modo TV acompanha a tela cheia de verdade.
    const onFs = () => {
      const on = !!document.fullscreenElement;
      setFull(on);
      document.documentElement.classList.toggle("tv-mode", on);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.documentElement.classList.remove("tv-mode");
    };
  }, []);

  async function alternar() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      document.documentElement.classList.add("tv-mode");
    } else {
      await document.exitFullscreen?.();
      document.documentElement.classList.remove("tv-mode");
    }
  }

  return (
    <button
      className="btn-ghost h-9 w-9 !p-0 max-sm:hidden"
      onClick={alternar}
      title={full ? "Sair de tela cheia" : "Tela cheia (TV)"}
      aria-label="Tela cheia"
    >
      {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    </button>
  );
}
