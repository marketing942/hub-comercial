-- =====================================================================
-- Receita do Conta Azul, linha a linha, com a CATEGORIA DO PROPRIO CONTA AZUL.
-- Idempotente: pode rodar mais de uma vez. Nao altera nenhum dado existente.
--
-- Por que: a Gestao a Vista (e, na proxima etapa, as metas) passam a trabalhar
-- com as linhas de receita que o Conta Azul tem, sem ligar item a item a uma
-- "linha do Hub". Cada item valido do Conta Azul vira UMA linha aqui, com:
--   categoria (a do Conta Azul), BU, e a origem (vendedores / direto / diretoria).
-- Quem preenche e o proprio espelho (Reprocessar / sync do Jarvis). Rode este
-- arquivo ANTES do deploy e depois clique em "Reprocessar" para os 3 meses.
-- =====================================================================
create table if not exists public.ca_linha_receita (
  ca_venda_id    text not null,
  ca_item_id     text not null,
  sale_date      date not null,
  valor          numeric(14,2) not null default 0,
  quantidade     numeric(14,4) not null default 1,
  categoria_id   text,                 -- categoria do Conta Azul (null = venda sem categoria e item sem historico)
  categoria_nome text not null,        -- como o Conta Azul chama; e o nome mostrado na tela
  bu             text check (bu in ('cppem', 'unicive', 'colegio_cppem')),  -- null = BU nao definida
  origem         text not null check (origem in ('vendedores', 'direto', 'diretoria')),
  seller_id      uuid,                 -- so quando origem = 'vendedores'
  sem_dono       boolean not null default false,  -- conta p/ vendedor mas chegou sem vendedor
  primary key (ca_venda_id, ca_item_id)
);
create index if not exists ca_linha_receita_data_idx on public.ca_linha_receita (sale_date);
alter table public.ca_linha_receita enable row level security;
