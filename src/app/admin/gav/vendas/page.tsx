import { redirect } from "next/navigation";

// A aba Vendas do GAV saiu; a Gestao a Vista e a unica. Mantem o endereco antigo vivo.
export default function VendasRedirect() {
  redirect("/admin/gav/gestao");
}
