-- =====================================================================
-- Indices de desempenho (idempotente: pode rodar quantas vezes quiser).
-- Rode no SQL Editor do Supabase do HUB. Nao altera dados.
--
-- Por que: o Hub filtra vendas/leads/metas por periodo (sale_date, date,
-- year+month) e consulta "vendas criadas depois de X" a cada poucos segundos
-- (aviso de venda nova). Sem indice o banco le a tabela inteira a cada
-- consulta, e isso piora conforme o historico cresce.
-- =====================================================================
create index if not exists sales_sale_date_idx          on public.sales (sale_date);
create index if not exists sales_seller_sale_date_idx   on public.sales (seller_id, sale_date);
create index if not exists sales_created_at_idx         on public.sales (created_at);
create index if not exists direct_sales_sale_date_idx   on public.direct_sales (sale_date);
create index if not exists daily_leads_date_idx         on public.daily_leads (date);
create index if not exists monthly_goals_period_idx     on public.monthly_goals (year, month);
create index if not exists product_goals_period_idx     on public.product_goals (year, month);
