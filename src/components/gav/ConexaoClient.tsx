"use client";

/**
 * Conexão com o Conta Azul e disparo manual do sync.
 *
 * O botão de sincronizar mostra o RESULTADO com contadores, e não um "pronto".
 * Um sync que "deu certo" lendo zero vendas é o modo de falha mais comum e mais
 * silencioso dessas integrações — quem aperta o botão precisa ver o número.
 */
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { COLOR } from "@/lib/brand";

type Resultado = {
  ok: boolean;
  error?: string;
  de?: string;
  ate?: string;
  lidas?: number;
  normalizacao?: {
    vendasConsideradas: number;
    paraSales: number;
    paraDireto: number;
    paraGrupo: number;
    pendentes: number;
    valorPendente: number;
    semDono: number;
    valorSemDono: number;
    ignorados: number;
    linhaInvalida: number;
  };
  ms?: number;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function ConexaoClient({
  configurada,
  ultimo,
}: {
  configurada: boolean;
  ultimo: { concluido_em?: string | null; erro?: string | null; lidos?: number | null } | null;
}) {
  const [rodando, setRodando] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [mes, setMes] = useState<string>("");

  /**
   * Os últimos 12 meses + a opção "3 meses de uma vez".
   *
   * A fatia por mês existe por causa do limite de execução da Vercel: a carga
   * dos 3 meses faz ~1.200 chamadas de detalhe a ~7,7 req/s, o que dá ~2,6 min
   * e estoura os 60s do plano Hobby. Um mês sozinho leva ~50s e cabe. No Pro
   * (300s) os 3 meses passam direto.
   */
  const meses = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { ym, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
    });
  }, []);

  async function sincronizar() {
    setRodando(true);
    setR(null);
    let corpo = "{}";
    if (mes) {
      const [y, m] = mes.split("-").map(Number);
      const ultimo = new Date(y, m, 0).getDate();
      corpo = JSON.stringify({ de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, "0")}` });
    }
    try {
      const res = await fetch("/api/ca/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: corpo,
      });
      setR((await res.json()) as Resultado);
    } catch (e) {
      setR({ ok: false, error: (e as Error).message });
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="panel p-4">
        <h2 className="eyebrow-label mb-3">De onde vem o dado</h2>

        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-white/50">
          O Hub <strong>não fala com o Conta Azul</strong>. Quem fala é o Jarvis, que já tem a
          conexão autorizada, e ele <strong>empurra</strong> o espelho para cá a cada rodada do
          próprio sync.
          <br />
          Não foi escolha de arquitetura, foi o que o Conta Azul permite: um aplicativo aceita{" "}
          <strong>uma única</strong> URL de redirecionamento (pedir o <code>authorize</code> do app
          do Jarvis com a URL do Hub devolve <code>redirect_mismatch</code>), e aplicativo criado
          como &ldquo;de produção&rdquo; não é reconhecido pela API v2 (<code>invalid_client</code>) —
          que é justamente a que traz venda, vendedor e itens.
          <br />
          O sentido da ponte é de propósito: o Jarvis tem os dados de toda a empresa e o Hub tem
          faturamento comercial. O endpoint exposto fica <strong>aqui</strong> — se o segredo
          vazar, vaza o lado que tem menos a perder. E se o Jarvis parar de empurrar, o dado
          <strong> envelhece</strong>: nenhuma tela quebra, porque todas leem do espelho local.
        </p>

        {configurada ? (
          <span className="chip" style={{ background: `${COLOR.ok}22`, color: COLOR.ok }}>
            Ponte configurada
          </span>
        ) : (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: `${COLOR.warning}1a`, color: COLOR.warning }}>
            Falta <code>JARVIS_PONTE_SECRET</code> no ambiente. Ele tem de ser idêntico ao{" "}
            <code>PONTE_HUB_SECRET</code> configurado no Jarvis, e é o que protege a rota{" "}
            <code>/api/ca/receber</code>.
          </p>
        )}
      </section>

      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow-label">Reprocessar</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input !py-1.5 text-xs"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              disabled={rodando}
              aria-label="Período a sincronizar"
            >
              <option value="">Últimos 3 meses</option>
              {meses.map((m) => (
                <option key={m.ym} value={m.ym}>
                  {m.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={sincronizar} disabled={!configurada || rodando} className="btn btn-primary">
              <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${rodando ? "animate-spin" : ""}`} />
              {rodando ? "Reprocessando..." : "Reprocessar agora"}
            </button>
          </div>
        </div>

        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-white/50">
          Isto <strong>não busca nada</strong>: relê o espelho que o Jarvis já empurrou e refaz a
          classificação. Serve para ver o efeito de uma classificação recém-feita sem esperar o
          próximo empurrão.
          <br />
          O padrão é a janela de <strong>3 meses</strong>. Se estourar o tempo no plano Hobby da
          Vercel (60s), reprocesse um mês por vez.
        </p>

        {ultimo?.concluido_em ? (
          <p className="text-xs text-white/40">
            Último empurrão do Jarvis: {new Date(ultimo.concluido_em).toLocaleString("pt-BR")}
            {typeof ultimo.lidos === "number" ? ` · ${ultimo.lidos} vendas lidas` : ""}
            {ultimo.erro ? (
              <span style={{ color: COLOR.danger }}> · {ultimo.erro}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-white/40">Nenhuma rodada registrada ainda.</p>
        )}

        {r ? (
          r.ok ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Caixa titulo="Vendas no espelho" valor={String(r.lidas ?? 0)} apoio={`${r.de} a ${r.ate}`} />
              <Caixa
                titulo="Para vendedor"
                valor={String(r.normalizacao?.paraSales ?? 0)}
                apoio={`${r.normalizacao?.paraDireto ?? 0} canal direto · ${r.normalizacao?.paraGrupo ?? 0} grupo`}
              />
              <Caixa
                titulo="Pendentes"
                valor={String(r.normalizacao?.pendentes ?? 0)}
                apoio={brl(r.normalizacao?.valorPendente ?? 0) + " sem classificação"}
                cor={r.normalizacao?.pendentes ? COLOR.warning : COLOR.ok}
              />
              {r.normalizacao?.semDono ? (
                <Caixa
                  titulo="Sem dono"
                  valor={String(r.normalizacao.semDono)}
                  apoio={brl(r.normalizacao.valorSemDono) + " conta p/ vendedor, sem vendedor"}
                  cor={COLOR.warning}
                />
              ) : null}
              {r.normalizacao?.linhaInvalida ? (
                <Caixa
                  titulo="Linha inválida"
                  valor={String(r.normalizacao.linhaInvalida)}
                  apoio="classificação aponta para linha que não existe"
                  cor={COLOR.danger}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: `${COLOR.danger}1a`, color: COLOR.danger }}>
              {r.error}
            </p>
          )
        ) : null}
      </section>

      <p className="text-[11px] leading-relaxed text-white/40">
        Esta integração <strong>só grava linhas com origem “Conta Azul”</strong> e todo apagamento
        filtra por ela. Nada do que foi lançado à mão é tocado — o dashboard atual continua
        mostrando exatamente o que mostra hoje.
      </p>
    </div>
  );
}

function Caixa({ titulo, valor, apoio, cor }: { titulo: string; valor: string; apoio?: string; cor?: string }) {
  return (
    <div className="card p-3">
      <p className="kpi-label text-white/40">{titulo}</p>
      <p className="kpi-num tabular-nums" style={cor ? { color: cor } : undefined}>
        {valor}
      </p>
      {apoio ? <p className="mt-0.5 text-[11px] text-white/40">{apoio}</p> : null}
    </div>
  );
}
