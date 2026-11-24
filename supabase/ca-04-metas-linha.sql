-- =====================================================================
-- Metas por LINHA DE RECEITA do Conta Azul (etapa 2). Idempotente.
-- Rode depois da ca-03. Nao altera nenhum dado existente.
--
-- Uma meta por BU + mes + categoria do Conta Azul. As metas antigas (por linha do
-- Hub) continuam onde estao; a tela "Metas por linha" pode convertê-las.
-- =====================================================================
create table if not exists public.ca_metas_linha (
  bu              text    not null check (bu in ('cppem', 'unicive', 'colegio_cppem')),
  year            integer not null check (year between 2024 and 2100),
  month           integer not null check (month between 1 and 12),
  categoria_id    text    not null,        -- categoria do Conta Azul
  valor_meta      numeric(14,2) not null default 0,
  quantidade_meta integer not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (bu, year, month, categoria_id)
);
alter table public.ca_metas_linha enable row level security;
