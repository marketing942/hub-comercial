import { redirect } from "next/navigation";

import GavComparativo from "@/components/GavComparativo";
import GavReceitaGrupo from "@/components/GavReceitaGrupo";
import PainelDashboard from "@/components/PainelDashboard";
import { getSession } from "@/lib/auth";
import { compararFontes, receitaDoGrupo } from "@/lib/gav";
import { parseYearMonth } from "@/lib/periodo";

export const dynamic = "force-dynamic";

/**
 * GAV — o dashboard de ensaio: o mesmo painel, 100% alimentado pelo Conta Azul,
 * como ele vai ficar depois do cutover.
 *
 * ## Só admin
 *
 * Não é por sigilo: é porque, até o cutover, estes números ainda podem estar
 * errados. Um vendedor que abrisse esta tela veria a própria meta com um número
 * que não vale — e passaria a discutir o número em vez de vender. Quando a
 * conferência fechar, `FONTE_PADRAO` vira `conta_azul` e todo mundo passa a ver
 * isto no dashboard normal, aí sim valendo.
 *
 * ## Por que não tem nada de cálculo aqui
 *
 * Tudo vem de `PainelDashboard`, o mesmo componente que serve `/dashboard`. A
 * única diferença entre as duas rotas é `fonte`. Se esta tela tivesse lógica
 * própria, bater com o dashboard normal não provaria nada sobre o cutover.
 */
export default async function GavPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const { year, month } = parseYearMonth(searchParams);
  const [comparacao, grupo] = await Promise.all([compararFontes(year, month), receitaDoGrupo(year, month)]);

  return (
    <PainelDashboard
      year={year}
      month={month}
      fonte="conta_azul"
      topo={
        <>
          <GavComparativo dados={comparacao} />
          <GavReceitaGrupo dados={grupo} />
        </>
      }
    />
  );
}
