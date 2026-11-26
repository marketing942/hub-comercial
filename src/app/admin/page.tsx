import { redirect } from "next/navigation";

// /admin abre a Gestao a Vista (carrossel com o GAV primeiro). Configuracoes fica
// na engrenagem do topo.
export default function AdminIndex() {
  redirect("/dashboard");
}
