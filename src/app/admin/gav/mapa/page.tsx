import { redirect } from "next/navigation";

// A Classificacao saiu do GAV e virou aba de Configuracoes. Redireciona para nao
// quebrar favoritos nem links antigos.
export default function MapaRedirect() {
  redirect("/admin/classificacao");
}
