import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { SidebarItem } from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "admin") redirect("/dashboard");

  const items: SidebarItem[] = [
    // Gestao a Vista = o carrossel (/dashboard). O 1o slide e o GAV (so admin).
    // Configuracoes virou a engrenagem ao lado do Sair (Sidebar.tsx).
    { href: "/dashboard", label: "Gestão à Vista", icon: "trophy" },
  ];

  return (
    <AppShell role="admin" items={items}>
      {children}
    </AppShell>
  );
}
