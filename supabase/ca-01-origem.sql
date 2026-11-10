-- Origem do faturamento: separa o que foi lançado à mão do que veio do Conta Azul.
--
-- É esta coluna que torna possível o GAV (/admin/gav): o mesmo dashboard, lendo
-- a outra origem, sem código paralelo. E é ela que torna o cutover uma troca de
-- constante em `src/lib/fonte.ts`, em vez de uma migração de dados.
--
-- Idempotente — pode rodar de novo sem efeito.
--
-- ## Ordem importa
--
-- Rode ANTES de subir o código que filtra por `origem`. Como a coluna nasce com
-- `default 'manual'` e `not null`, toda linha que já existe vira 'manual'
-- automaticamente: o dashboard atual continua mostrando exatamente o que mostra
-- hoje, sem nenhuma linha a mais nem a menos.

alter table public.sales
  add column if not exists origem      text not null default 'manual',
  add column if not exists ca_venda_id text,
  add column if not exists ca_item_id  text,
  add column if not exists ca_versao   integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sales_origem_check') then
    alter table public.sales
      add constraint sales_origem_check check (origem in ('manual', 'conta_azul'));
  end if;
end $$;

-- Idempotência DO SYNC, no banco e não no código: um item de uma venda do Conta
-- Azul vira no máximo uma linha aqui. Sem isto, uma rodada repetida (ou que
-- morreu no meio) duplica faturamento — e o duplicado parcial é pior que a
-- falha, porque o total continua plausível.
create unique index if not exists sales_ca_item_uniq
  on public.sales (ca_venda_id, ca_item_id)
  where origem = 'conta_azul';

-- A tela lê um mês inteiro de uma origem só; sem este índice vira varredura.
create index if not exists sales_origem_date_idx
  on public.sales (origem, sale_date);

-- ---------------------------------------------------------------------------
-- Canal direto (site): mesma estrutura. É para onde vão os cadastros do Conta
-- Azul que não são vendedor nenhum — "SITE / DIRETO" e "Site - Vendas Avulsas".
-- ---------------------------------------------------------------------------
alter table public.direct_sales
  add column if not exists origem      text not null default 'manual',
  add column if not exists ca_venda_id text,
  add column if not exists ca_item_id  text,
  add column if not exists ca_versao   integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'direct_sales_origem_check') then
    alter table public.direct_sales
      add constraint direct_sales_origem_check check (origem in ('manual', 'conta_azul'));
  end if;
end $$;

create unique index if not exists direct_sales_ca_item_uniq
  on public.direct_sales (ca_venda_id, ca_item_id)
  where origem = 'conta_azul';

create index if not exists direct_sales_origem_date_idx
  on public.direct_sales (origem, sale_date);

comment on column public.sales.origem is
  'manual = lançado pelo vendedor no Hub. conta_azul = espelhado da venda do CA. Ver src/lib/fonte.ts.';
comment on column public.direct_sales.origem is
  'manual = lançado no Hub. conta_azul = cadastro do CA marcado como canal direto.';
