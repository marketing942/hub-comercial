import { redirect } from "next/navigation";

// A Gamificacao virou a secao "Minha comissao" do Meu Painel (25/11/2026).
export default function GamificacaoRedirect({ searchParams }: { searchParams: { bu?: string } }) {
  redirect(searchParams.bu ? `/seller?bu=${encodeURIComponent(searchParams.bu)}` : "/seller");
}
