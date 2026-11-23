"use client";
import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Tela cheia da Gestao a Vista (para a TV/monitor). Mesmo mecanismo do
 * Dashboard TV: fullscreen do documento + classe `tv-mode` (esconde a barra do
 * topo e compacta os espacamentos). Como o fullscreen e do DOCUMENTO, trocar de
 * mes continua em tela cheia. A classe acompanha o evento do navegador, entao
 * sair com ESC tambem a remove.
 */
export default function BotaoTelaCheia() {
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    const aoMudar = () => {
      const ativa = !!document.fullscreenElement;
      document.documentElement.classList.toggle("tv-mode", ativa);
      setCheia(ativa);
    };
    document.addEventListener("fullscreenchange", aoMudar);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudar);
      document.documentElement.classList.remove("tv-mode");
    };
  }, []);

  async function alternar() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // navegador sem suporte/recusou: nada a fazer
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="btn-ghost h-9 w-9 !p-0 max-sm:hidden"
      title={cheia ? "Sair da tela cheia" : "Tela cheia"}
      aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}
    >
      {cheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}
