import Link from "next/link";

import VendasDoMes from "@/components/gav/VendasDoMes";
import VendasMesAMes from "@/components/gav/VendasMesAMes";
import { periodNow } from "@/lib/calc";
import { vendasAno } from "@/lib/vendasMes";
import { MES_CURTO } from "@/lib/vendasMesTipos";
import { YEAR_MAX, YEAR_MIN } from "@/lib/yearMath";

export const dynamic = "force-dynamic";

/**
 * Vendas — o mês a mês do ano, e as vendas do mês escolhido.
 *
 * Tomou o lugar da aba "Conexao e sync" (2026-11-23), que perdeu o sentido
 * quando o espelho passou a ser empurrado pelo Jarvis a cada 15 minutos: não
 * há mais o que disparar à mão no dia a dia. A rota antiga continua de pé em
 * `/admin/gav/conexao` — só saiu do menu — porque o botão de sync manual ainda
 * salva um aperto quando algo trava. A frescura do espelho, que era o motivo
 * real de abrir aquela aba, agora aparece aqui no rodapé, onde o dado está.
 *
 * A porta de admin está no layout de `/admin/gav`.
 */
export default async function VendasPage({
  searchParams,
}: {
  searchParams: { year?: string; mes?: string };
}) {
  const agora = periodNow();

  const y = Number(searchParams.year);
  const year = Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX ? y : agora.year;

  const m = Number(searchParams.mes);
  // Ano anterior abre em dezembro (o mês corrente não existe lá); o ano atual
  // abre no mês de hoje.
  const padraoMes = year === agora.year ? agora.month : 12;
  const mes = Number.isInteger(m) && m >= 1 && m <= 12 ? m : padraoMes;

  const dados = await vendasAno(year, mes);

  const anos: number[] = [];
  for (let a = agora.year; a >= Math.max(YEAR_MIN, agora.year - 3); a--) anos.push(a);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-sm text-white/50">
            Mes a mes do ano e todas as vendas do mes, direto do Conta Azul.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {anos.map((a) => (
            <Link
              key={a}
              href={`/admin/gav/vendas?year=${a}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                a === year ? "bg-accent text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      </div>

      <VendasMesAMes dados={dados} />

      {/* Trocar de mês sem precisar abrir o pop-up. São links, não botões: cada
          mês é um endereço, dá para compartilhar e voltar pelo navegador. */}
      <nav className="no-scrollbar flex gap-1 overflow-x-auto" aria-label="Escolher o mes">
        {MES_CURTO.map((nome, i) => {
          const n = i + 1;
          const vazio = dados.meses[i].valor <= 0;
          return (
            <Link
              key={nome}
              href={`/admin/gav/vendas?year=${year}&mes=${n}`}
              aria-current={n === mes ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                n === mes
                  ? "bg-accent text-black"
                  : vazio
                    ? "text-white/25 hover:text-white/50"
                    : "text-white/60 hover:text-white"
              }`}
            >
              {nome}
            </Link>
          );
        })}
      </nav>

      <VendasDoMes categorias={dados.detalhe} mes={mes} year={year} />

      <p className="text-xs text-white/35">
        {dados.sync.erro ? (
          <span style={{ color: "#ee7d73" }}>
            Ultimo sync do espelho falhou: {dados.sync.erro}.{" "}
          </span>
        ) : dados.sync.em ? (
          <>Espelho do Conta Azul atualizado em {new Date(dados.sync.em).toLocaleString("pt-BR")}. </>
        ) : (
          <>Nunca sincronizado. </>
        )}
        <Link href="/admin/gav/conexao" className="underline hover:text-white/60">
          Conexao e sync
        </Link>
      </p>
    </div>
  );
}
