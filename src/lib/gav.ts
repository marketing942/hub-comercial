/**
 * GAV — a comparação entre o faturamento lançado à mão e o que vem do Conta Azul.
 *
 * O dashboard do GAV mostra o mês como ele ficaria DEPOIS do cutover. Mas um
 * dashboard idêntico em outra aba não responde "está certo?": obriga a comparar
 * de olho, número a número. Esta função é a resposta — ela põe as duas origens
 * lado a lado e mostra a diferença.
 *
 * ## Por vendedor, não só no total
 *
 * O total pode fechar por compensação (um vendedor a mais, outro a menos) e
 * esconder exatamente o erro que mais dói, que é o número individual — é sobre
 * ele que caem meta e comissão. Por isso a comparação é por pessoa, e o total é
 * só o resumo.
 *
 * ## Custo
 *
 * São duas passadas pelos mesmos leitores de `data.ts`, uma por origem. Os
 * loaders são memoizados por (ano, mês, **fonte**), então cada origem é lida uma
 * vez por requisição — não é o dobro do trabalho de uma tela, é o trabalho de
 * duas telas, que é o que de fato se está comparando.
 */
import { statsForAll } from "./data";
import type { SellerStats } from "./calc";
import type { Fonte } from "./fonte";
import { FONTE_PADRAO } from "./fonte";

export type LinhaComparacao = {
  chave: string;
  rotulo: string;
  bu: SellerStats["bu"] | null;
  manual: number;
  contaAzul: number;
  /** contaAzul − manual. Negativo = o Conta Azul está vendo menos. */
  diferenca: number;
  /** Variação relativa sobre o manual (0–1). `null` quando o manual é zero. */
  variacao: number | null;
};

export type Comparacao = {
  year: number;
  month: number;
  total: LinhaComparacao;
  porVendedor: LinhaComparacao[];
  porBu: LinhaComparacao[];
  /** A migração `ca-01-origem.sql` ainda não rodou — ver `loadMonthSales`. */
  semColunaOrigem: boolean;
};

const variacao = (manual: number, ca: number): number | null =>
  manual > 0 ? ca / manual - 1 : null;

function linha(chave: string, rotulo: string, bu: SellerStats["bu"] | null, manual: number, ca: number): LinhaComparacao {
  return { chave, rotulo, bu, manual, contaAzul: ca, diferenca: ca - manual, variacao: variacao(manual, ca) };
}

export async function compararFontes(year: number, month: number): Promise<Comparacao> {
  const [manual, ca] = await Promise.all([
    statsForAll({ year, month, fonte: FONTE_PADRAO }),
    statsForAll({ year, month, fonte: "conta_azul" satisfies Fonte }),
  ]);

  /**
   * Soma por (vendedor × BU) e agrega depois.
   *
   * `statsForAll` devolve UMA linha por par (vendedor, BU) — um vendedor
   * multi-BU aparece duas vezes. Somar direto por `sellerId` sem passar pela BU
   * continuaria certo no total, mas perderia a quebra por unidade, que é onde a
   * divergência costuma estar (a Unicive do Victor e do Pablo, por exemplo).
   */
  const porPessoa = new Map<string, { nome: string; bu: SellerStats["bu"]; manual: number; ca: number }>();
  const soma = (linhas: SellerStats[], campo: "manual" | "ca") => {
    for (const s of linhas) {
      const k = `${s.sellerId}|${s.bu}`;
      const a = porPessoa.get(k) ?? { nome: s.sellerName, bu: s.bu, manual: 0, ca: 0 };
      a[campo] += s.valorRealizado;
      porPessoa.set(k, a);
    }
  };
  soma(manual, "manual");
  soma(ca, "ca");

  const porVendedor = [...porPessoa]
    .map(([k, a]) => linha(k, a.nome, a.bu, a.manual, a.ca))
    .sort((x, y) => y.manual - x.manual);

  const porBuMap = new Map<SellerStats["bu"], { manual: number; ca: number }>();
  for (const a of porPessoa.values()) {
    const b = porBuMap.get(a.bu) ?? { manual: 0, ca: 0 };
    b.manual += a.manual;
    b.ca += a.ca;
    porBuMap.set(a.bu, b);
  }
  const porBu = [...porBuMap].map(([bu, a]) => linha(bu, bu, bu, a.manual, a.ca)).sort((x, y) => y.manual - x.manual);

  const totManual = porVendedor.reduce((s, l) => s + l.manual, 0);
  const totCa = porVendedor.reduce((s, l) => s + l.contaAzul, 0);

  /**
   * Heurística honesta para "a migração não rodou": o manual tem número e o
   * Conta Azul está zerado em TUDO. Não é prova — um mês legitimamente sem
   * venda do CA daria o mesmo —, por isso a tela trata como aviso, não como
   * erro, e diz o que conferir.
   */
  const semColunaOrigem = totManual > 0 && totCa === 0;

  return {
    year,
    month,
    total: linha("total", "Total", null, totManual, totCa),
    porVendedor,
    porBu,
    semColunaOrigem,
  };
}
