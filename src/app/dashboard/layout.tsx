import { getSession } from "@/lib/auth";
import { getSeller } from "@/lib/data";
import AppShell from "@/components/AppShell";
import type { SidebarItem } from "@/components/Sidebar";
import { redirect } from "next/navigation";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const isAdmin = s.role === "admin";
  const seller = !isAdmin && s.sellerId ? await getSeller(s.sellerId) : null;

  const items: SidebarItem[] = isAdmin
    ? [{ href: "/dashboard", label: "Gestão à Vista", icon: "trophy" }]
    : [
        { href: "/dashboard", label: "Gestão à Vista", icon: "trophy" },
        { href: "/seller", label: "Meu Painel", icon: "dashboard" },
      ];

  return (
    <AppShell role={s.role} sellerName={seller?.name} items={items}>
      {children}
    </AppShell>
  );
}
