/**
 * O dashboard (carrossel de slides) — compartilhado por `/dashboard` e `/admin/gav`.
 *
 * ## Por que existe
 *
 * O GAV precisa ser a MESMA tela lendo a outra origem. Se ele tivesse a própria
 * montagem de slides, bater com o dashboard normal não provaria nada sobre o
 * cutover: provaria só que dois programas diferentes chegaram ao mesmo número
 * uma vez. Este componente é o caminho único; a única coisa que muda entre as
 * duas rotas é a prop `fonte`.
 *
 * Era o corpo de `src/app/dashboard/page.tsx` e foi movido para cá sem alteração
 * de comportamento — o `/dashboard` continua chamando com `FONTE_PADRAO`.
 */
import { unstable_cache } from "next/cache";

import DashboardCarousel from "@/components/DashboardCarousel";
import DashboardView from "@/components/DashboardView";
import DirectDashboardView from "@/components/DirectDashboardView";
import SellersGameView from "@/components/SellersGameView";
import PeriodNav from "@/components/PeriodNav";
import { BU_LABEL } from "@/lib/brand";
import {
  buListOf,
  dashboardSnapshot,
  daysInMonth,
  daysRemainingIncludingToday,
  directSnapshot,
  getSeller,
  indicacaoBreakdown,
  ligacaoBreakdown,
  statsForAll,
  todayDayOfMonth,
} from "@/lib/data";
import type { Fonte } from "@/lib/fonte";
import { ALL_BUS, type BU } from "@/lib/products";
import { getSession } from "@/lib/auth";
import { DASHBOARD_TAG } from "@/lib/supabase";

const DASHBOARD_CACHE_SECONDS = 120;

/**
 * Cache de servidor COMPARTILHADO entre abas e TVs.
 *
 * ⚠️ `fonte` entra na chave (`dashboard-data-v3-${fonte}`) **e** nos argumentos.
 * Sem isso, o dashboard normal e o GAV serviriam um o cache do outro — e, como
 * este cache é de servidor, o erro atravessaria usuários e telas, não só a
 * requisição. Seria o GAV exibindo número manual rotulado como Conta Azul, que é
 * o pior resultado possível numa tela cuja função é conferir.
 */
const carregar = (fonte: Fonte) =>
  unstable_cache(
    async (year: number, month: number) => {
      const stats = await statsForAll({ year, month, fonte });
      const [snaps, direct, ligacaoAll, indicacaoAll] = await Promise.all([
        Promise.all(ALL_BUS.map((bu) => dashboardSnapshot(bu, { year, month, fonte }, stats))),
        directSnapshot({ year, month, fonte }),
        ligacaoBreakdown({ year, month, fonte }),
        indicacaoBreakdown({ year, month, fonte }),
      ]);
      return { snaps, direct, ligacaoAll, indicacaoAll };
    },
    [`dashboard-data-v3-${fonte}`],
    { revalidate: DASHBOARD_CACHE_SECONDS, tags: [DASHBOARD_TAG] },
  );

export default async function PainelDashboard({
  year,
  month,
  fonte,
  /** Conteúdo extra acima do carrossel — o GAV põe a faixa de comparação aqui. */
  topo,
}: {
  year: number;
  month: number;
  fonte: Fonte;
  topo?: React.ReactNode;
}) {
  const totalDays = daysInMonth(year, month);
  const day = todayDayOfMonth(year, month);
  const daysLeft = daysRemainingIncludingToday(year, month);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const { snaps, direct, ligacaoAll, indicacaoAll } = await carregar(fonte)(year, month);
  const allSellers = snaps.flatMap((s) => s.sellers);

  // Filtra os slides por role: vendedor so ve as BUs em que atua e o slide de
  // Vendedores. Admin ve tudo (incluindo Direto / IA).
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  let allowedBus: BU[] = [...ALL_BUS];
  if (!isAdmin && session?.sellerId) {
    const seller = await getSeller(session.sellerId);
    allowedBus = seller ? buListOf(seller) : [];
  }
  const allowedBuSet = new Set<BU>(allowedBus);

  const buSlides = snaps
    .filter((snap) => isAdmin || allowedBuSet.has(snap.bu))
    .map((snap) => ({
      key: snap.bu,
      label: BU_LABEL[snap.bu],
      node: (
        <DashboardView
          snap={snap}
          day={day}
          totalDays={totalDays}
          daysLeft={daysLeft}
          monthName={monthName}
        />
      ),
    }));

  const slides = [
    ...buSlides,
    ...(isAdmin
      ? [
          {
            key: "direto",
            label: "Direto / IA",
            node: (
              <DirectDashboardView
                snap={direct}
                day={day}
                totalDays={totalDays}
                daysLeft={daysLeft}
                monthName={monthName}
              />
            ),
          },
        ]
      : []),
    {
      key: "sellers",
      label: "Vendedores",
      node: (
        <SellersGameView
          stats={allSellers}
          monthName={monthName}
          day={day}
          totalDays={totalDays}
          daysLeft={daysLeft}
          ligacao={isAdmin ? ligacaoAll : undefined}
          indicacao={isAdmin ? indicacaoAll : undefined}
        />
      ),
    },
  ];

  return (
    <>
      {topo}
      <DashboardCarousel
        slides={slides}
        intervalSec={25}
        refreshMs={60000}
        periodNav={<PeriodNav year={year} month={month} />}
      />
    </>
  );
}
