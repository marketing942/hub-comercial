import { redirect } from "next/navigation";

// A Gestao a Vista virou o 1o slide (GAV) do carrossel em /dashboard.
export default function Redirecionar() {
  redirect("/dashboard");
}
