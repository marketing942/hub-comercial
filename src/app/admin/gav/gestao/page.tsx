import Link from "next/link";

import Cell from "@/components/StatCell";
import GestaoCategorias from "@/components/gav/GestaoCategorias";
import BotaoTelaCheia from "@/components/gav/BotaoTelaCheia";
import GestaoGrafico from "@/components/gav/GestaoGraficoLazy";
import { BRL, fmtPct, periodNow } from "@/lib/calc";
import { gestaoDoMes } from "@/lib/gestaoAVista";
import { COR_ORIGEM, ORIGEM_ROTULO, type Origem } from "@/lib/gestaoAVistaTipos";
import { MES_CURTO, MES_NOME } from "@/lib/vendasMesTipos";
import { YEAR_MAX, YEAR_MIN } from "@/lib/yearMath";

export const dynamic = "force-dynamic";

/**
 * Gestao a Vista — faturamento da empresa inteira no mes, todas as linhas de
 * receita do Conta Azul. A porta de admin esta no layout de `/admin/gav`.
 */
export default async function GestaoPage({
  searchParams,
}: {
  searchParams: { year?: string; mes?: string; modo?: string };
}) {
  const agora = periodNow();
  const y = Number(searchParams.year);
  const year = Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX ? y : agora.year;
  const anual = searchParams.modo === "anual";
  const m = Number(searchParams.mes);
  const mes = Number.isInteger(m) && m >= 1 && m <= 12 ? m : year === agora.year ? agora.month : 12;

  const dados = await gestaoDoMes(year, anual ? null : mes);
  const anos: number[] = [];
  for (let a = agora.year; a >= Math.max(YEAR_MIN, agora.year - 3); a--) anos.push(a);

  const origens: Origem[] = ["vendedores", "direto", "diretoria"];
  const pct = (v: number) => (dados.total > 0 ? fmtPct((v / dados.total) * 100) : "—");
  // Cada combinacao e um endereco (da para compartilhar e voltar pelo navegador).
  const href = (o: { modo?: "mensal" | "anual"; year?: number; mes?: number }) => {
    const modo = o.modo ?? (anual ? "anual" : "mensal");
    const yr = o.year ?? year;
    const mm = o.mes ?? (yr === year ? mes : yr === agora.year ? agora.month : 12);
    return `/admin/gav/gestao?modo=${modo}&year=${yr}${modo === "mensal" ? `&mes=${mm}` : ""}`;
  };
  const pilula = (ativo: boolean) =>
    `shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      ativo ? "bg-accent text-black" : "text-white/60 hover:text-white"
    }`;
  const grupo = "inline-flex items-center gap-0.5 rounded-xl border border-border bg-panel p-1";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestão a Vista</h1>
          <p className="text-sm text-white/50">
            Faturamento da empresa {anual ? `em ${year}, mês a mês` : `em ${MES_NOME[mes - 1]} de ${year}, dia a dia`} —
            todas as linhas de receita do Conta Azul.
          </p>
        </div>
        <BotaoTelaCheia />
      </div>

      {/* Filtros numa barra so: visao (mensal/anual), ano e, no mensal, o mes. */}
      <section className="panel flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
        <div className="flex items-center gap-2">
          <span className="kpi-label">Visão</span>
          <div className={grupo} role="tablist" aria-label="Visão">
            <Link href={href({ modo: "mensal" })} role="tab" aria-selected={!anual} className={pilula(!anual)}>
              Mensal
            </Link>
            <Link href={href({ modo: "anual" })} role="tab" aria-selected={anual} className={pilula(anual)}>
              Anual
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="kpi-label">Ano</span>
          <div className={grupo}>
            {anos.map((a) => (
              <Link key={a} href={href({ year: a })} aria-current={a === year ? "page" : undefined} className={pilula(a === year)}>
                {a}
              </Link>
            ))}
          </div>
        </div>

        {!anual && (
          <div className="flex min-w-0 items-center gap-2">
            <span className="kpi-label">Mês</span>
            <nav className={`${grupo} no-scrollbar max-w-full overflow-x-auto`} aria-label="Escolher o mês">
              {MES_CURTO.map((nome, i) => (
                <Link
                  key={nome}
                  href={href({ mes: i + 1 })}
                  aria-current={i + 1 === mes ? "page" : undefined}
                  className={pilula(i + 1 === mes)}
                >
                  {nome}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </section>

      {/* Quem trouxe a receita: vendedores, direto e diretoria. */}
      <section className="panel overflow-hidden">
        <div className="-ml-px -mt-px grid grid-cols-2 md:grid-cols-4">
          <Cell label={anual ? `Total ${year}` : `Total ${MES_CURTO[mes - 1]}/${year}`} value={BRL.format(dados.total)}>
            Todas as linhas de receita
          </Cell>
          {origens.map((o) => (
            <Cell key={o} label={ORIGEM_ROTULO[o]} value={BRL.format(dados.porOrigem[o])}>
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle"
                style={{ background: COR_ORIGEM[o] }}
              />
              {pct(dados.porOrigem[o])} do total
              {o === "diretoria" && dados.semDono > 0 ? <> · inclui {BRL.format(dados.semDono)} sem dono</> : null}
            </Cell>
          ))}
        </div>
      </section>

      {dados.conferencia && !dados.semTabela ? (() => {
        const dif = dados.conferencia.caTotal - dados.total;
        const ok = Math.abs(dif) < 1;
        return (
          <div
            className="panel px-4 py-2.5 text-sm"
            style={{ borderColor: ok ? undefined : "rgba(240,180,76,0.45)", color: ok ? "#5fd08f" : "#f0b44c" }}
          >
            {ok ? (
              <>Conferido: o total desta tela bate com as vendas do Conta Azul no período ({BRL.format(dados.conferencia.caTotal)}).</>
            ) : (
              <>
                Conta Azul (vendas faturadas/aprovadas): <b>{BRL.format(dados.conferencia.caTotal)}</b> · esta tela:{" "}
                <b>{BRL.format(dados.total)}</b> · diferença <b>{BRL.format(dif)}</b>
                <span className="text-white/50">
                  {" "}
                  — itens marcados &quot;ignorar&quot; e vendas sem item. Se a diferença for maior que isso, rode Reprocessar.
                </span>
              </>
            )}
          </div>
        );
      })() : null}

      {dados.semTabela ? (
        <div className="panel p-4 text-sm" style={{ borderColor: "rgba(240,180,76,0.45)" }}>
          <div className="eyebrow-label" style={{ color: "#f0b44c" }}>Falta criar a tabela</div>
          <p className="mt-1.5 text-white/70">
            Rode <b>supabase/ca-03-linha-receita.sql</b> no SQL Editor do Supabase e clique em Reprocessar (Conexao e sync).
          </p>
        </div>
      ) : null}

      <GestaoGrafico dias={dados.dias} categorias={dados.categorias} anual={anual} />

      <GestaoCategorias dados={dados} />

      <p className="text-xs text-white/35">
        {dados.sync.erro ? (
          <span style={{ color: "#ee7d73" }}>Ultimo sync do espelho falhou: {dados.sync.erro}. </span>
        ) : dados.sync.em ? (
          <>Espelho do Conta Azul atualizado em {new Date(dados.sync.em).toLocaleString("pt-BR")}. </>
        ) : (
          <>Nunca sincronizado. </>
        )}
        Categorias do proprio Conta Azul; vendedor, direto e diretoria vem da{" "}
        <Link href="/admin/classificacao" className="underline hover:text-white/60">
          Classificacao
        </Link>
        .{" "}
        <Link href="/admin/gav/conexao" className="underline hover:text-white/60">
          Conexao e sync
        </Link>
      </p>
    </div>
  );
}
