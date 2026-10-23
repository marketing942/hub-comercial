"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Target, Receipt, Coins, Zap, ShoppingCart, CalendarRange } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  { href: "/admin/sellers", label: "Vendedores", icon: <Users className="w-3.5 h-3.5" /> },
  { href: "/admin/goals", label: "Metas", icon: <Target className="w-3.5 h-3.5" /> },
  { href: "/admin/vendas", label: "Todas as Vendas", icon: <Receipt className="w-3.5 h-3.5" /> },
  { href: "/admin/comissoes", label: "Comissoes", icon: <Coins className="w-3.5 h-3.5" /> },
  { href: "/admin/leads", label: "Leads", icon: <Zap className="w-3.5 h-3.5" /> },
  { href: "/admin/direto", label: "Direto / IA", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { href: "/admin/ano", label: "Ano", icon: <CalendarRange className="w-3.5 h-3.5" /> },
];

export default function ConfiguracoesSubnav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-bg/85 backdrop-blur border-b border-border">
      <div className="flex items-center gap-2">
        <div className="text-[11px] uppercase tracking-wider text-white/40 mr-1 hidden sm:block">
          Configuracoes
        </div>
        <div className="flex sm:inline-flex p-1 rounded-xl bg-panel border border-border overflow-x-auto no-scrollbar max-w-full">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                ref={active ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center" }) : undefined}
                className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap px-3.5 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
                  active
                    ? "bg-accent text-black"
                    : "text-white/60 hover:text-white"
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
