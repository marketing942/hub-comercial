/**
 * Faixa de matriculas do proximo ano no topo do painel do Colegio: numeros
 * informados pelo time (Configuracoes -> Colegio), sempre o total ate o momento.
 * Nao depende do mes escolhido no carrossel. Some enquanto nada foi preenchido.
 */
import { ANO_LETIVO, type ResumoColegio } from "@/lib/colegioMatriculas";
import { fmtInt, fmtPct } from "@/lib/calc";
import { BU_COLOR } from "@/lib/brand";

export default function MatriculasColegio({ resumo: r, atualizadoEm }: { resumo: ResumoColegio; atualizadoEm: string | null }) {
  const n = (v: number) => fmtInt.format(v);
  const pct = (v: number) => (r.elegiveis > 0 ? fmtPct((v / r.elegiveis) * 100) : "—");
  const AZUL = BU_COLOR.colegio_cppem;
  const quando = atualizadoEm
    ? new Date(atualizadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit" })
    : null;
  // Baixa de proposito (o painel precisa caber na TV 768p): detalhes AO LADO do numero.
  // "Alunos confirmados" e o resultado do Colegio: celula mais larga, fundo azul da BU
  // e numero bem maior. As outras tres sao apoio.
  const celulas: { rotulo: string; valor: number; linhas: [string, string][]; destaque?: boolean }[] = [
    { rotulo: `Alunos confirmados ${ANO_LETIVO}`, valor: r.confirmados, destaque: true, linhas: [["Rematriculados", n(r.rematriculas)], ["Novas matriculas", n(r.novas)]] },
    { rotulo: "Rematriculas", valor: r.rematriculas, linhas: [["Dos que podem", pct(r.rematriculas)], ["Desistencias", n(r.desistencias)]] },
    { rotulo: "Ainda sem resposta", valor: r.semResposta, linhas: [["Dos que podem", pct(r.semResposta)], ["Podem rematricular", n(r.elegiveis)]] },
    { rotulo: `Alunos hoje (${ANO_LETIVO - 1})`, valor: r.alunosHoje, linhas: [["Concluintes", n(r.concluintes)], ["Atualizado", quando ?? "—"]] },
  ];
  return (
    <section className="panel overflow-hidden">
      <div className="-ml-px -mt-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
        {celulas.map((c) => (
          <div
            key={c.rotulo}
            className={`cell min-w-0 px-4 ${c.destaque ? "pt-1.5 pb-1" : "py-2.5"}`}
            style={c.destaque ? { background: `linear-gradient(120deg, ${AZUL}3d, ${AZUL}12)`, boxShadow: `inset 4px 0 0 ${AZUL}` } : undefined}
          >
            <div className={`kpi-label truncate leading-tight ${c.destaque ? "!text-[12px] !text-white" : ""}`}>{c.rotulo}</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div
                className={`font-display font-bold leading-none tabular-nums ${
                  c.destaque ? "text-[clamp(2.2rem,2.9vw,3.4rem)] text-white" : "text-[clamp(1.4rem,1.8vw,1.8rem)] text-white/85"
                }`}
              >
                {n(c.valor)}
              </div>
              <dl className={`min-w-0 space-y-0.5 leading-tight ${c.destaque ? "text-[12.5px]" : "text-[11px]"}`}>
                {c.linhas.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-end gap-2">
                    <dt className={`truncate ${c.destaque ? "text-white/70" : "text-white/45"}`}>{k}</dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-white/90">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
