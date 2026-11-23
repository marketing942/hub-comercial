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
    // GAV: so admin. Hoje tem a Gestao a Vista (faturamento da empresa).
    { href: "/admin/gav", label: "GAV", icon: "chart" },
    {
      href: "/admin/sellers",
      label: "Configuracoes",
      icon: "settings",
      activePrefixes: ["/admin/goals", "/admin/vendas", "/admin/comissoes", "/admin/leads", "/admin/direto", "/admin/ano", "/admin/classificacao"],
    },
  ];

  return (
    <AppShell role="admin" items={items}>
      {children}
    </AppShell>
  );
}
