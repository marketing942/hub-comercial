"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

export type SidebarItem = {
  href: string;
  label: string;
  icon: string; // mantido por compatibilidade com os layouts; a navegacao nao usa icones
  // Outros prefixos de rota que tambem marcam esse item como ativo
  activePrefixes?: string[];
};

// Navegacao no topo: libera toda a largura da tela pro dashboard (TV).
export default function Sidebar({
  role,
  sellerName,
  items,
}: {
  role: "admin" | "seller";
  sellerName?: string;
  items: SidebarItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isActive = (it: SidebarItem) =>
    pathname === it.href ||
    (it.href !== "/" && pathname.startsWith(it.href + "/")) ||
    (it.activePrefixes || []).some((p) => pathname === p || pathname.startsWith(p + "/"));

  const who = sellerName || (role === "admin" ? "Admin" : "Vendedor");

  return (
    <header className="app-topbar sticky top-0 z-50 border-b border-[var(--hair)] bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1800px] h-14 px-4 sm:px-6 flex items-center gap-8">
        <Link
          href={role === "admin" ? "/admin" : "/dashboard"}
          className="font-display font-bold tracking-[0.14em] text-[15px] uppercase whitespace-nowrap"
        >
          Hub <span className="text-accent">Comercial</span>
        </Link>

        <nav className="hidden md:flex items-stretch gap-1 h-full">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`relative px-4 grid place-items-center font-ui font-bold uppercase tracking-[0.12em] text-[13px] transition ${
                isActive(it) ? "text-accent" : "text-white/55 hover:text-white"
              }`}
            >
              {it.label}
              {isActive(it) && <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-accent rounded-full" />}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="font-ui text-[11px] uppercase tracking-[0.14em] text-white/40">
              {role === "admin" ? "Administrador" : "Vendedor"}
            </span>
            <span className="font-semibold">{who}</span>
          </div>
          <button onClick={logout} className="btn-ghost !py-1.5 !px-3 text-xs" title="Sair">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
          <button
            className="md:hidden w-9 h-9 grid place-items-center rounded-lg bg-panel2"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-[var(--hair)] px-4 py-2 grid gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`px-3 py-2.5 rounded-lg font-ui font-bold uppercase tracking-[0.1em] text-sm ${
                isActive(it) ? "bg-accent/15 text-accent" : "text-white/70"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
