import { redirect } from "next/navigation";

// "Minhas Vendas" saiu: o vendedor acompanha tudo no Meu Painel e na Gamificacao.
export default function MinhasVendasRedirect() {
  redirect("/seller");
}
