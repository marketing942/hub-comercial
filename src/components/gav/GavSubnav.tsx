"use client";

/**
 * Sub-abas do GAV. Mesmo desenho do `ConfiguracoesSubnav` — pílula, item ativo
 * em dourado sobre preto, Rajdhani maiúsculo (ver CLAUDE.md §3).
 *
 * Tudo que diz respeito ao Conta Azul mora sob ESTE botão. Foi o pedido: a
 * mudança inteira fica num canto do painel de admin, e nada dela aparece para
 * vendedor.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, ShoppingCart } from "lucide-react";

const TABS = [
  // "Conexao e sync" saiu do menu em 2026-11-23: com o Jarvis empurrando o
  // espelho a cada 15 min, nao ha mais o que disparar a mao no dia a dia. A
  // rota continua de pe e a pagina de Vendas linka para ela no rodape.
  { href: "/admin/gav/vendas", label: "Vendas", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { href: "/admin/gav/gestao", label: "Gestão à Vista", icon: <Gauge className="w-3.5 h-3.5" /> },
];

export default function GavSubnav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-bg/85 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="mr-1 hidden text-[11px] uppercase tracking-wider text-white/40 sm:block">GAV</div>
        <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-xl border border-border bg-panel p-1 sm:inline-flex">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-xs font-semibold transition sm:py-1.5 ${
                  active ? "bg-accent text-black" : "text-white/60 hover:text-white"
                }`}
              >
                {t.icon}
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
