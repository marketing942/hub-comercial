import { redirect } from "next/navigation";

// "Direto / IA" (lancamento manual) saiu: o direto/IA vem do Conta Azul e aparece no Dashboard TV.
export default function DiretoRedirect() {
  redirect("/dashboard");
}
