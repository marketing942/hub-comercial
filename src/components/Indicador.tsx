/**
 * Celula PADRAO de indicador dos paineis (BUs e Meu Painel), desde 25/11/2026:
 *   rotulo · numero principal (sempre o REALIZADO, o UNICO com cor) ·
 *   linhas "rotulo ... valor" sem cor (meta, falta, pace, projecao...).
 * Cor do numero: verde = bateu / no ritmo · vermelho = atras · branco = em
 * andamento ou sem meta. Sem barra de progresso. Usa o padrao `.cell` (ver StatCell).
 */
import { COLOR } from "@/lib/brand";

/** Linha "rotulo ... valor" de um indicador (sem cor). */
export type Linha = [string, string];

/** Celula padrao da faixa de indicadores (ver comentario em `ritmo`). */
export default function Indicador({ label, value, tone, linhas }: { label: string; value: string; tone?: string; linhas: Linha[] }) {
  return (
    <div className="cell flex min-w-0 flex-col p-4">
      <div className="kpi-label truncate leading-tight">{label}</div>
      <div
        className="mt-1.5 truncate font-display font-bold leading-none tabular-nums text-[clamp(1.25rem,1.7vw,1.75rem)]"
        style={{ color: tone || COLOR.neutral }}
      >
        {value}
      </div>
      {linhas.length > 0 && (
        <dl className="mt-3 space-y-1 border-t border-[var(--hair)] pt-2 text-[12px] leading-snug">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="shrink-0 text-white/45">{k}</dt>
              <dd className="min-w-0 truncate text-right font-semibold tabular-nums text-white/85">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

