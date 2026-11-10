import { redirect } from "next/navigation";

import GavSubnav from "@/components/gav/GavSubnav";
import { getSession } from "@/lib/auth";

/**
 * Casca do GAV.
 *
 * A porta de admin está aqui, e não só em cada página: uma rota nova criada
 * debaixo de `/admin/gav` nasce protegida, em vez de depender de alguém lembrar
 * de copiar o `redirect`. O layout de `/admin` já barra não-admin — este é o
 * segundo cadeado, de propósito.
 */
export default async function GavLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "admin") redirect("/dashboard");

  return (
    <>
      <GavSubnav />
      <div className="pt-3">{children}</div>
    </>
  );
}
