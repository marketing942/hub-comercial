/**
 * O vendedor que o Conta Azul não consegue mais dizer.
 *
 * ## O problema que esta tabela resolve
 *
 * Venda de site sai do Conta Azul como `SITE / DIRETO`, sem vendedor. Depois de
 * **emitida e gerada**, o vendedor não é mais editável lá. Quando o valor na
 * verdade é de alguém, não há conserto na origem — e o Hub, que obedece ao
 * Conta Azul, mandaria para canal direto um valor que é de uma dupla.
 *
 * ## Por que não em `ca_vendedores`
 *
 * `ca_vendedores.destino` decide por VENDEDOR DO CA, não por venda. Apontar
 * `SITE / DIRETO` para um seller mandaria **toda** venda de site para ele,
 * inclusive as que são mesmo de canal direto. O problema é por venda, então a
 * correção é por venda.
 *
 * ## Por que em código, e não em tabela
 *
 * Tabela era o desenho melhor, e seria uma linha de DDL. Mas o Supabase do Hub
 * não está acessível para DDL por aqui — criar a tabela seria SQL rodado à mão
 * no painel, e override sem tabela nenhuma é melhor do que override numa tabela
 * que ninguém lembra de ter criado. A troca: incluir um caso novo é editar este
 * arquivo e publicar, em vez de um insert.
 *
 * ## Por que `ca_venda_id` é a chave
 *
 * A ponte **apaga e reinsere a janela de 90 dias a cada 15 min**, então
 * `sales.id` e `created_at` não sobrevivem; linha sintética inserida à mão com
 * `origem = 'conta_azul'` é varrida na rodada seguinte. `ca_venda_id` vem do
 * Conta Azul e atravessa a reescrita — é a única chave estável.
 *
 * ## Ao incluir um caso
 *
 * Diga o **número da venda** e o **motivo** no comentário. Sem isso, meses
 * depois ninguém sabe por que o número do Hub difere do Conta Azul, e a
 * primeira conclusão de quem achar a diferença vai ser "o Hub está errado".
 */

export interface OverrideVenda {
  /** `ca_vendas.ca_id` — a chave que sobrevive à reescrita da ponte. */
  caVendaId: string;
  /** `sellers.id` de quem a venda é de verdade. */
  sellerId: string;
  /** Número da venda no Conta Azul, para conferência humana. */
  numero: string;
  /** Por quê. Obrigatório na prática. */
  motivo: string;
}

const PABLO_CHOI = "4fa538e5-a957-4334-8b5f-e6b211fb734d";
const VICTOR_WILLYANS = "bd7ccc52-5da2-4a9a-b133-062ceb3c3fa2";

/**
 * EBK - TECNO UNICIVE, novembro/2026 — R$ 589,20 em 8 vendas.
 *
 * Emitidas como venda direta por erro de lançamento no Conta Azul. O item já
 * está mapeado certo (`unicive / matriculas`); o que estava errado era só o
 * vendedor, e não é mais editável na origem. Decisão de 25/11/2026: dividir
 * igualmente entre a dupla da Unicive.
 *
 * ⚠️ **Divisão igual exata é impossível com 8 vendas inteiras.** São sete de
 * R$ 69,90 e uma de R$ 99,90; a metade seria R$ 294,60. O corte mais próximo é
 * 4 vendas para cada um — igual na CONTAGEM (que é o que a meta de 180
 * matrículas usa) e R$ 15,00 de distância da metade em valor, para cada lado:
 * Pablo R$ 279,60 e Victor R$ 309,60. Qualquer outro corte afasta mais.
 */
const UNICIVE_EBK_NOV26: OverrideVenda[] = [
  { numero: "1793732632", caVendaId: "123b5fb1-a3d2-4311-8c7c-64ccb7cd150b", sellerId: PABLO_CHOI, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  { numero: "1793727565", caVendaId: "af2c6e83-59c5-4db0-b769-a0d3b1fd5658", sellerId: PABLO_CHOI, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  { numero: "1793736126", caVendaId: "e048f4b7-f535-4e53-a7ee-2172c3a8e4f9", sellerId: PABLO_CHOI, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  { numero: "1793919109", caVendaId: "41b861b4-a3c1-40f3-9c9d-845da1916f2a", sellerId: PABLO_CHOI, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  { numero: "1794006595", caVendaId: "4f0bcf53-e8f3-4c1f-87c0-ca869d5f4afb", sellerId: VICTOR_WILLYANS, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  { numero: "1794225304", caVendaId: "1aee9e1f-2f22-4e8d-974a-c43ed80e5f29", sellerId: VICTOR_WILLYANS, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  { numero: "1794596245", caVendaId: "8231b2c1-f031-4bd8-8352-1f92d48b832d", sellerId: VICTOR_WILLYANS, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
  // A única de R$ 99,90 — é ela que faz a divisão não fechar redonda.
  { numero: "1794277202", caVendaId: "843eddd6-0186-4ee8-8314-128ba2a9fde1", sellerId: VICTOR_WILLYANS, motivo: "EBK Unicive emitido como venda direta; vendedor não editável no CA" },
];

export const OVERRIDES_VENDA: OverrideVenda[] = [...UNICIVE_EBK_NOV26];

/** `ca_venda_id` → `seller_id`. Consultado em `./normaliza.ts`. */
export const OVERRIDE_POR_VENDA: ReadonlyMap<string, string> = new Map(
  OVERRIDES_VENDA.map((o) => [o.caVendaId, o.sellerId]),
);
