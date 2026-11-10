import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { SidebarItem } from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "admin") redirect("/dashboard");

  const items: SidebarItem[] = [
    { href: "/dashboard", label: "Dashboard TV", icon: "trophy" },
    // GAV: o dashboard lendo o Conta Azul, para conferir antes do cutover.
    // So admin — ate a conferencia fechar estes numeros ainda podem estar
    // errados, e vendedor vendo a propria meta com numero que nao vale passa a
    // discutir o numero em vez de vender. Ver src/lib/fonte.ts.
    { href: "/admin/gav", label: "GAV", icon: "chart" },
    {
      href: "/admin/sellers",
      label: "Configuracoes",
      icon: "settings",
      activePrefixes: ["/admin/goals", "/admin/vendas", "/admin/comissoes", "/admin/leads", "/admin/direto", "/admin/ano"],
    },
  ];

  return (
    <AppShell role="admin" items={items}>
      {children}
    </AppShell>
  );
}
