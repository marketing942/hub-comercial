/**
 * O dashboard (carrossel de slides) — usado por `/dashboard`.
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
import GavPainel from "@/components/gav/GavPainel";
import { gestaoDoMes } from "@/lib/gestaoAVista";
import PeriodNav from "@/components/PeriodNav";
import { BU_LABEL } from "@/lib/brand";
import {
  buListOf,
  dashboardSnapshot,
  daysInMonth,
  daysRemainingIncludingToday,
  directSnapshot,
  getSeller,
  statsForAll,
  todayDayOfMonth,
} from "@/lib/data";
import type { Fonte } from "@/lib/fonte";
import { ALL_BUS, type BU } from "@/lib/products";
import { getSession } from "@/lib/auth";
import { DASHBOARD_TAG, supabaseAdmin } from "@/lib/supabase";

// O cache cai sozinho a cada envio do Conta Azul (revalidateTag nas escritas);
// o tempo so cobre o que muda com o relogio (dia corrente, ritmo).
const DASHBOARD_CACHE_SECONDS = 300;

/**
 * Cache de servidor COMPARTILHADO entre abas e TVs.
 *
 * ⚠️ `fonte` entra na chave (`dashboard-data-v5-${fonte}`) **e** nos argumentos.
 * Sem isso, o dashboard normal e o GAV serviriam um o cache do outro — e, como
 * este cache é de servidor, o erro atravessaria usuários e telas, não só a
 * requisição. Seria o GAV exibindo número manual rotulado como Conta Azul, que é
 * o pior resultado possível numa tela cuja função é conferir.
 */
const carregar = (fonte: Fonte) =>
  unstable_cache(
    async (year: number, month: number) => {
      const stats = await statsForAll({ year, month, fonte });
      const [snaps, direct] = await Promise.all([
        Promise.all(ALL_BUS.map((bu) => dashboardSnapshot(bu, { year, month, fonte }, stats))),
        directSnapshot({ year, month, fonte }),
      ]);
      return { snaps, direct };
    },
    [`dashboard-data-v5-${fonte}`],
    { revalidate: DASHBOARD_CACHE_SECONDS, tags: [DASHBOARD_TAG] },
  );

export default async function PainelDashboard({
  year,
  month,
  fonte,
}: {
  year: number;
  month: number;
  fonte: Fonte;
}) {
  const totalDays = daysInMonth(year, month);
  const day = todayDayOfMonth(year, month);
  const daysLeft = daysRemainingIncludingToday(year, month);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const { snaps, direct } = await carregar(fonte)(year, month);
  const allSellers = snaps.flatMap((s) => s.sellers);

  // Filtra os slides por role: vendedor so ve as BUs em que atua e o slide de
  // Vendedores. Admin ve tudo (o Direto virou detalhe clicavel dentro do GAV).
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

  // GAV (Gestao a Vista da empresa): primeiro slide, so admin. Le o Conta Azul
  // inteiro (ca_linha_receita), entao so faz sentido na fonte Conta Azul.
  const gav = isAdmin && fonte === "conta_azul" ? await gestaoDoMes(year, month) : null;

  const slides = [
    ...(gav
      ? [
        {
          key: "gav",
          label: "GAV",
          node: (
            <GavPainel
              dados={gav}
              year={year}
              month={month}
              detalheDireto={<DirectDashboardView snap={direct} gav={gav} year={year} month={month} />}
            />
          ),
        },
      ]
      : []),
    ...buSlides,
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
        />
      ),
    },
  ];

  // Ultimo envio do Conta Azul — lido FORA do cache, a cada render: e o horario
  // que a tela mostra como "atualizado", entao nao pode vir velho.
  let sync: { em: string | null; erro: string | null } = { em: null, erro: null };
  try {
    const { data } = await supabaseAdmin.from("ca_sync").select("concluido_em, erro").eq("recurso", "vendas").maybeSingle();
    if (data) sync = { em: (data as any).concluido_em ?? null, erro: (data as any).erro ?? null };
  } catch {
    /* sem tabela: mostra "nunca" */
  }

  return (
    <>
      <DashboardCarousel
        sync={{ ...sync, link: isAdmin ? "/admin/gav/conexao" : undefined }}
        slides={slides}
        intervalSec={25}
        refreshMs={180000}
        periodNav={<PeriodNav year={year} month={month} />}
      />
    </>
  );
}
