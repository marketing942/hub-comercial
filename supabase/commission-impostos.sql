-- Comissao depois de impostos (26/11/2026). Idempotente: pode rodar mais de uma vez.
-- Ligada (after_tax), a % da faixa incide sobre o faturamento do vendedor MENOS
-- tax_pct (% media de impostos da empresa). Vem DESLIGADA.
alter table public.commission_rules add column if not exists after_tax boolean not null default false;
alter table public.commission_rules add column if not exists tax_pct numeric(5,2) not null default 0;

-- A opcao "acumulativa entre faixas" saiu do Hub: o calculo usa sempre a maior faixa.
update public.commission_rules set cumulative = false where cumulative is true;
