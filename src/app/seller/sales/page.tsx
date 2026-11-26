import { redirect } from "next/navigation";

// "Minhas Vendas" saiu: o vendedor acompanha tudo no Meu Painel.
export default function MinhasVendasRedirect() {
  redirect("/seller");
}
