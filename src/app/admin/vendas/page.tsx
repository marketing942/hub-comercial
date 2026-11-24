import { redirect } from "next/navigation";

// "Todas as Vendas" (lancamento manual) saiu: tudo vem do Conta Azul. Mantem o endereco vivo.
export default function VendasRedirect() {
  redirect("/admin/sellers");
}
