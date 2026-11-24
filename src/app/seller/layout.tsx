import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSeller } from "@/lib/data";
import AppShell from "@/components/AppShell";
import type { SidebarItem } from "@/components/Sidebar";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "seller") redirect("/admin/sellers");
  if (!s.sellerId) redirect("/login");
  const seller = await getSeller(s.sellerId);
  if (!seller) redirect("/login");

  const items: SidebarItem[] = [
    { href: "/dashboard", label: "Dashboard TV", icon: "trophy" },
    { href: "/seller", label: "Meu Painel", icon: "dashboard" },
    { href: "/seller/gamification", label: "Gamificacao", icon: "game" },
  ];

  return (
    <AppShell role="seller" sellerName={seller.name} items={items}>
      {children}
    </AppShell>
  );
}
