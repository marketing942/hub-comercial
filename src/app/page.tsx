import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "admin") redirect("/admin/sellers");
  if (s.role === "supervisor") redirect("/dashboard");
  if (!s.sellerId) redirect("/login");
  redirect("/seller");
}
