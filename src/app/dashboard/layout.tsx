import { getSession } from "@/lib/auth";
import { getSeller } from "@/lib/data";
import AppShell from "@/components/AppShell";
import NewSaleNotifier from "@/components/NewSaleNotifier";
import type { SidebarItem } from "@/components/Sidebar";
import { redirect } from "next/navigation";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const isAdmin = s.role === "admin";
  const seller = !isAdmin && s.sellerId ? await getSeller(s.sellerId) : null;

  const items: SidebarItem[] = isAdmin
    ? [
        { href: "/dashboard", label: "Dashboard TV", icon: "trophy" },
        {
          href: "/admin/sellers",
          label: "Configuracoes",
          icon: "settings",
          activePrefixes: ["/admin/goals", "/admin/vendas", "/admin/comissoes", "/admin/leads", "/admin/direto", "/admin/ano"],
        },
      ]
    : [
        { href: "/dashboard", label: "Dashboard TV", icon: "trophy" },
        { href: "/seller", label: "Meu Painel", icon: "dashboard" },
        { href: "/seller/sales", label: "Minhas Vendas", icon: "cart" },
        { href: "/seller/gamification", label: "Gamificacao", icon: "game" },
      ];

  return (
    <AppShell role={s.role} sellerName={seller?.name} items={items}>
      {children}
      {/* Notificacao comemorativa quando uma venda nova entra. Fica no
          layout do /dashboard pra aparecer em todos os slides. */}
      <NewSaleNotifier />
    </AppShell>
  );
}
