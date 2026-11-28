-- ⚠️ RODAR no SQL Editor do Supabase (projeto do Hub).
--
-- ca_vendas ganha a CATEGORIA DO EVENTO FINANCEIRO da venda.
--
-- ## Por que existe uma segunda categoria
--
-- No Conta Azul a VENDA tem uma categoria e o RECEBÍVEL dela pode ter outra. O
-- DRE e a aba Faturamento do Jarvis classificam receita pela do EVENTO; a Gestão
-- à Vista classificava pela da VENDA. Medido em 27/11/2026 contra a conta real
-- (set–nov): de 1.807 recebíveis ligados a venda, **496 divergiam — R$ 59.515,91**:
--
--   R$ 30.625,64  o evento diz MATRÍCULA UNICIVE  e a venda não tem categoria
--   R$ 14.988,66  o evento diz EVENTOS CPPEM      e a venda diz TURMAS PRESENCIAIS
--   R$  6.065,59  o evento diz Receitas a Identificar e a venda não tem categoria
--
-- Era a mesma receita repartida de dois jeitos. O EVENTOS CPPEM não aparecia na
-- Gestão à Vista porque nenhuma VENDA carrega essa categoria — o dinheiro estava
-- aqui, somado dentro de TURMAS PRESENCIAIS.
--
-- ## Por que uma coluna NOVA, e não sobrescrever `categoria_ca_id`
--
-- `normaliza.ts` usa `categoria_ca_id` para DOIS caminhos: a Gestão à Vista e
-- `sales` (meta e comissão do vendedor). Sobrescrever levaria aquelas 247 vendas
-- para EVENTOS CPPEM, que não tem linha de receita — elas cairiam em "pendente" e
-- os vendedores perderiam R$ 14.988,66 de crédito em três meses. A categoria do
-- evento vale só para a receita por categoria; quem credita vendedor segue a
-- categoria da venda.
--
-- ## É só acréscimo
--
-- Coluna anulável, sem default, sem backfill. O Jarvis a preenche no próximo
-- empurrão da ponte; enquanto estiver vazia, `normaliza.ts` usa a categoria da
-- venda e nada muda. Antes de rodar isto, o Hub também não quebra: o empurrão
-- detecta a coluna faltando, regrava sem ela e avisa.

alter table public.ca_vendas
  add column if not exists categoria_evento_ca_id text;

comment on column public.ca_vendas.categoria_evento_ca_id is
  'Categoria do EVENTO FINANCEIRO (recebível) desta venda, vinda do Jarvis. Usada só pela receita por categoria (Gestão à Vista); meta e comissão seguem categoria_ca_id, a da venda. NULL = o Jarvis ainda não tem o de-para.';
