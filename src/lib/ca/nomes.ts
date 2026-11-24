/**
 * Nome do vendedor como vem do Conta Azul. Cadastro em CAIXA ALTA ("ELIAS DA SILVA")
 * vira "Elias da Silva"; quem ja esta com minusculas fica como esta.
 */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function nomeDoCA(nome: string | null | undefined): string {
  const n = String(nome ?? "").replace(/\s+/g, " ").trim();
  if (!n) return "";
  if (n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}
