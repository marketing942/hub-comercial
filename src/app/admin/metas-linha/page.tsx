import { redirect } from "next/navigation";

// "Metas por linha" foi unificada na tela de Metas (Configuracoes > Metas).
export default function MetasLinhaRedirect() {
  redirect("/admin/goals");
}
