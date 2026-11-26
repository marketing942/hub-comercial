import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSeller, buListOf } from "@/lib/data";
import { BU_COLOR } from "@/lib/brand";
import AvatarUploader from "@/components/AvatarUploader";
import ChangePasswordButton from "@/components/ChangePasswordButton";
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
    { href: "/dashboard", label: "Gestão à Vista", icon: "trophy" },
    { href: "/seller", label: "Meu Painel", icon: "dashboard" },
  ];

  return (
    <AppShell
      role="seller"
      sellerName={seller.name}
      items={items}
      extra={
        // Foto e senha moraram no cabecalho do Meu Painel ate 26/11/2026; agora ficam na barra.
        <>
          <AvatarUploader name={seller.name} initialUrl={seller.avatar_url} color={BU_COLOR[buListOf(seller)[0] ?? "cppem"]} />
          <ChangePasswordButton sellerName={seller.name} hasPassword={Boolean(seller.has_password)} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
