import Sidebar, { type SidebarItem } from "./Sidebar";

export default function AppShell({
  role,
  sellerName,
  items,
  children,
}: {
  role: "admin" | "seller";
  sellerName?: string;
  items: SidebarItem[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Sidebar role={role} sellerName={sellerName} items={items} />
      <main className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 py-5">{children}</main>
    </div>
  );
}
