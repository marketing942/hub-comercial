import Sidebar, { type SidebarItem } from "./Sidebar";

export default function AppShell({
  role,
  sellerName,
  items,
  extra,
  children,
}: {
  role: "admin" | "supervisor" | "seller";
  sellerName?: string;
  items: SidebarItem[];
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Sidebar role={role} sellerName={sellerName} items={items} extra={extra} />
      <main className="mx-auto w-full max-w-[1800px] px-3 sm:px-4 py-4">{children}</main>
    </div>
  );
}
