import { redirect } from "next/navigation";

// O Painel do GAV foi removido: o Dashboard TV (/dashboard) ja le o Conta Azul
// (FONTE_PADRAO em src/lib/fonte.ts). O GAV agora so tem a aba Vendas.
export default function GavIndex() {
  redirect("/admin/gav/vendas");
}
