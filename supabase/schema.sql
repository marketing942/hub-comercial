-- Estrutura real do banco do Hub Comercial (gerada do banco em producao em 06/10/2026).
-- Rode no SQL Editor de um projeto Supabase vazio. Os dados nao estao aqui.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

CREATE OR REPLACE FUNCTION public.cac_data_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public."breakeven_data" (
  "product" text not null,
  "data" jsonb not null,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid,
  constraint "breakeven_data_pkey" PRIMARY KEY (product),
  constraint "breakeven_data_product_check" CHECK ((product = ANY (ARRAY['cppem'::text, 'unicv'::text])))
);

create table if not exists public."bu_meta" (
  "bu" text not null,
  "year" integer not null,
  "month" integer not null,
  "leads_meta" integer default 0 not null,
  "taxa_conversao_meta" numeric(5,2) default 0 not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "bu_meta_pkey" PRIMARY KEY (bu, year, month),
  constraint "bu_meta_bu_check" CHECK ((bu = ANY (ARRAY['cppem'::text, 'unicive'::text, 'colegio_cppem'::text]))),
  constraint "bu_meta_month_check" CHECK (((month >= 1) AND (month <= 12))),
  constraint "bu_meta_year_check" CHECK (((year >= 2024) AND (year <= 2100)))
);

create table if not exists public."bu_product_goals" (
  "id" uuid default gen_random_uuid() not null,
  "bu" text not null,
  "month" integer not null,
  "year" integer not null,
  "product_line" text not null,
  "valor_meta" numeric(14,2) default 0 not null,
  "quantidade_meta" integer default 0 not null,
  constraint "bu_product_goals_bu_year_month_product_line_key" UNIQUE (bu, year, month, product_line),
  constraint "bu_product_goals_pkey" PRIMARY KEY (id),
  constraint "bu_product_goals_bu_check" CHECK ((bu = ANY (ARRAY['cppem'::text, 'unicive'::text, 'colegio_cppem'::text]))),
  constraint "bu_product_goals_month_check" CHECK (((month >= 1) AND (month <= 12))),
  constraint "bu_product_goals_year_check" CHECK (((year >= 2024) AND (year <= 2100)))
);

create table if not exists public."cac_data" (
  "year" integer not null,
  "product" text not null,
  "data" jsonb not null,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid,
  constraint "cac_data_pkey" PRIMARY KEY (year, product),
  constraint "cac_data_product_check" CHECK ((product = ANY (ARRAY['cppem'::text, 'colegio'::text, 'unicv'::text])))
);

create table if not exists public."commission_rules" (
  "bu" text not null,
  "min_meta_pct" numeric(5,2) default 80 not null,
  "cumulative" boolean default false not null,
  "bu_bonus_extra_pct" numeric(5,2) default 10 not null,
  "top1_bonus" numeric(10,2) default 300 not null,
  "top2_bonus" numeric(10,2) default 200 not null,
  "top3_bonus" numeric(10,2) default 100 not null,
  "notes" text,
  "updated_at" timestamp with time zone default now() not null,
  constraint "commission_rules_pkey" PRIMARY KEY (bu),
  constraint "commission_rules_bu_check" CHECK ((bu = ANY (ARRAY['cppem'::text, 'unicive'::text, 'colegio_cppem'::text])))
);

create table if not exists public."commission_tiers" (
  "id" uuid default gen_random_uuid() not null,
  "bu" text not null,
  "meta_pct" numeric(5,2) not null,
  "commission_pct" numeric(5,2) not null,
  constraint "commission_tiers_bu_meta_pct_key" UNIQUE (bu, meta_pct),
  constraint "commission_tiers_pkey" PRIMARY KEY (id),
  constraint "commission_tiers_bu_check" CHECK ((bu = ANY (ARRAY['cppem'::text, 'unicive'::text, 'colegio_cppem'::text])))
);

create table if not exists public."direct_sales" (
  "id" uuid default gen_random_uuid() not null,
  "sale_date" date default CURRENT_DATE not null,
  "product_line" text not null,
  "valor" numeric(12,2) default 0 not null,
  "quantidade" integer default 1 not null,
  "observacao" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "channel" text default 'direto'::text not null,
  constraint "direct_sales_pkey" PRIMARY KEY (id),
  constraint "direct_sales_channel_check" CHECK ((channel = ANY (ARRAY['direto'::text, 'ia'::text])))
);

create table if not exists public."direct_visits" (
  "id" uuid default gen_random_uuid() not null,
  "date" date not null,
  "qty" integer default 0 not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "direct_visits_date_key" UNIQUE (date),
  constraint "direct_visits_pkey" PRIMARY KEY (id)
);

create table if not exists public."long_term_goals" (
  "id" uuid default gen_random_uuid() not null,
  "bu" text not null,
  "label" text not null,
  "base_count" integer default 0 not null,
  "target" integer default 0 not null,
  "start_year" integer not null,
  "start_month" integer not null,
  "end_year" integer not null,
  "end_month" integer not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "long_term_goals_pkey" PRIMARY KEY (id),
  constraint "long_term_goals_bu_check" CHECK ((bu = ANY (ARRAY['cppem'::text, 'unicive'::text, 'colegio_cppem'::text]))),
  constraint "long_term_goals_end_month_check" CHECK (((end_month >= 1) AND (end_month <= 12))),
  constraint "long_term_goals_start_month_check" CHECK (((start_month >= 1) AND (start_month <= 12)))
);

create table if not exists public."metas_data" (
  "product" text not null,
  "year" integer not null,
  "data" jsonb not null,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid,
  constraint "metas_data_pkey" PRIMARY KEY (product, year),
  constraint "metas_data_product_check" CHECK ((product = ANY (ARRAY['cppem'::text, 'colegio'::text, 'unicv'::text])))
);

create table if not exists public."motivational_quotes" (
  "id" uuid default gen_random_uuid() not null,
  "text" text not null,
  "author" text,
  constraint "motivational_quotes_pkey" PRIMARY KEY (id)
);

create table if not exists public."pace_data" (
  "product" text not null,
  "year" integer not null,
  "month" integer not null,
  "meta" numeric default 0 not null,
  "realizado" numeric default 0 not null,
  "updated_at" timestamp with time zone default now() not null,
  "meta_leads" numeric default 0 not null,
  "leads_realizados" numeric default 0 not null,
  "ticket_medio_meta" numeric default 0 not null,
  "ticket_medio_real" numeric default 0 not null,
  "conversao_meta" numeric default 0 not null,
  "conversao_real" numeric default 0 not null,
  constraint "pace_data_pkey" PRIMARY KEY (product, year, month),
  constraint "pace_data_month_check" CHECK (((month >= 1) AND (month <= 12))),
  constraint "pace_data_product_check" CHECK ((product = ANY (ARRAY['cppem'::text, 'colegio'::text, 'unicv'::text])))
);

create table if not exists public."realizado_data" (
  "product" text not null,
  "year" integer not null,
  "data" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now() not null,
  constraint "realizado_data_pkey" PRIMARY KEY (product, year),
  constraint "realizado_data_product_check" CHECK ((product = ANY (ARRAY['cppem'::text, 'colegio'::text, 'unicv'::text])))
);

create table if not exists public."sellers" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "bu" text not null,
  "bus" text[] default '{}'::text[] not null,
  "active" boolean default true not null,
  "avatar_color" text default '#22c55e'::text not null,
  "avatar_url" text,
  "password_hash" text,
  "created_at" timestamp with time zone default now() not null,
  constraint "sellers_pkey" PRIMARY KEY (id),
  constraint "sellers_bu_check" CHECK ((bu = ANY (ARRAY['cppem'::text, 'unicive'::text, 'colegio_cppem'::text])))
);
-- Migracao idempotente: coluna de senha individual por vendedor
-- (login unificado — cada vendedor tem uma chave propria).
alter table public.sellers add column if not exists password_hash text;

create table if not exists public."daily_leads" (
  "id" uuid default gen_random_uuid() not null,
  "seller_id" uuid not null,
  "date" date not null,
  "qty" integer default 0 not null,
  constraint "daily_leads_seller_id_date_key" UNIQUE (seller_id, date),
  constraint "daily_leads_pkey" PRIMARY KEY (id)
);

create table if not exists public."monthly_goals" (
  "id" uuid default gen_random_uuid() not null,
  "seller_id" uuid not null,
  "month" integer not null,
  "year" integer not null,
  "ticket_medio_meta" numeric(12,2) default 0 not null,
  "taxa_conversao_meta" numeric(5,2) default 0 not null,
  "valor_meta" numeric(14,2) default 0 not null,
  "quantidade_meta" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "leads_meta" integer default 0 not null,
  "bu" text not null,
  constraint "monthly_goals_seller_bu_year_month_key" UNIQUE (seller_id, bu, year, month),
  constraint "monthly_goals_pkey" PRIMARY KEY (id),
  constraint "monthly_goals_month_check" CHECK (((month >= 1) AND (month <= 12))),
  constraint "monthly_goals_year_check" CHECK (((year >= 2024) AND (year <= 2100)))
);

create table if not exists public."product_goals" (
  "id" uuid default gen_random_uuid() not null,
  "seller_id" uuid not null,
  "month" integer not null,
  "year" integer not null,
  "product_line" text not null,
  "valor_meta" numeric(14,2) default 0 not null,
  "quantidade_meta" integer default 0 not null,
  constraint "product_goals_seller_id_month_year_product_line_key" UNIQUE (seller_id, month, year, product_line),
  constraint "product_goals_pkey" PRIMARY KEY (id),
  constraint "product_goals_month_check" CHECK (((month >= 1) AND (month <= 12))),
  constraint "product_goals_year_check" CHECK (((year >= 2024) AND (year <= 2100)))
);

create table if not exists public."sales" (
  "id" uuid default gen_random_uuid() not null,
  "seller_id" uuid not null,
  "sale_date" date default CURRENT_DATE not null,
  "product_line" text not null,
  "valor" numeric(12,2) default 0 not null,
  "quantidade" integer default 1 not null,
  "cliente_nome" text,
  "observacao" text,
  "ligacao_status" text default 'sem_ligacao'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "indicacao_status" text default 'sem_indicacao'::text not null,
  constraint "sales_pkey" PRIMARY KEY (id)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_leads_seller_id_fkey') then
    alter table public.daily_leads add constraint "daily_leads_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'monthly_goals_seller_id_fkey') then
    alter table public.monthly_goals add constraint "monthly_goals_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'product_goals_seller_id_fkey') then
    alter table public.product_goals add constraint "product_goals_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sales_seller_id_fkey') then
    alter table public.sales add constraint "sales_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
  end if;
end $$;

CREATE INDEX IF NOT EXISTS bu_product_goals_period_idx ON public.bu_product_goals USING btree (bu, year, month);
CREATE INDEX IF NOT EXISTS commission_tiers_bu_idx ON public.commission_tiers USING btree (bu, meta_pct);
CREATE INDEX IF NOT EXISTS daily_leads_seller_date_idx ON public.daily_leads USING btree (seller_id, date);
CREATE INDEX IF NOT EXISTS direct_sales_channel_idx ON public.direct_sales USING btree (channel);
CREATE INDEX IF NOT EXISTS direct_sales_date_idx ON public.direct_sales USING btree (sale_date);
CREATE INDEX IF NOT EXISTS direct_visits_date_idx ON public.direct_visits USING btree (date);
CREATE INDEX IF NOT EXISTS long_term_goals_bu_active_idx ON public.long_term_goals USING btree (bu, active);
CREATE INDEX IF NOT EXISTS product_goals_seller_period_idx ON public.product_goals USING btree (seller_id, year, month);
CREATE INDEX IF NOT EXISTS sales_indicacao_idx ON public.sales USING btree (indicacao_status);
CREATE INDEX IF NOT EXISTS sales_ligacao_idx ON public.sales USING btree (ligacao_status);
CREATE INDEX IF NOT EXISTS sales_seller_date_idx ON public.sales USING btree (seller_id, sale_date);
CREATE INDEX IF NOT EXISTS sellers_bu_idx ON public.sellers USING btree (bu);
CREATE INDEX IF NOT EXISTS sellers_bus_idx ON public.sellers USING gin (bus);

drop trigger if exists cac_data_updated_at on public.cac_data;
CREATE TRIGGER cac_data_updated_at BEFORE UPDATE ON public.cac_data FOR EACH ROW EXECUTE FUNCTION cac_data_set_updated_at();
drop trigger if exists breakeven_data_updated_at on public.breakeven_data;
CREATE TRIGGER breakeven_data_updated_at BEFORE UPDATE ON public.breakeven_data FOR EACH ROW EXECUTE FUNCTION cac_data_set_updated_at();
drop trigger if exists metas_data_updated_at on public.metas_data;
CREATE TRIGGER metas_data_updated_at BEFORE UPDATE ON public.metas_data FOR EACH ROW EXECUTE FUNCTION cac_data_set_updated_at();
drop trigger if exists pace_data_updated_at on public.pace_data;
CREATE TRIGGER pace_data_updated_at BEFORE UPDATE ON public.pace_data FOR EACH ROW EXECUTE FUNCTION cac_data_set_updated_at();
drop trigger if exists realizado_data_updated_at on public.realizado_data;
CREATE TRIGGER realizado_data_updated_at BEFORE UPDATE ON public.realizado_data FOR EACH ROW EXECUTE FUNCTION cac_data_set_updated_at();

alter table public."cac_data" enable row level security;
alter table public."breakeven_data" enable row level security;
alter table public."metas_data" enable row level security;
alter table public."pace_data" enable row level security;
alter table public."direct_sales" enable row level security;
alter table public."direct_visits" enable row level security;
alter table public."long_term_goals" enable row level security;
alter table public."commission_rules" enable row level security;
alter table public."commission_tiers" enable row level security;
alter table public."realizado_data" enable row level security;
alter table public."sales" enable row level security;
alter table public."motivational_quotes" enable row level security;
alter table public."sellers" enable row level security;
alter table public."monthly_goals" enable row level security;
alter table public."product_goals" enable row level security;
alter table public."bu_product_goals" enable row level security;
alter table public."bu_meta" enable row level security;
alter table public."daily_leads" enable row level security;
drop policy if exists "cac_data delete" on public."cac_data";
create policy "cac_data delete" on public."cac_data" as permissive for delete to authenticated using (true);
drop policy if exists "cac_data insert" on public."cac_data";
create policy "cac_data insert" on public."cac_data" as permissive for insert to authenticated with check (true);
drop policy if exists "cac_data read" on public."cac_data";
create policy "cac_data read" on public."cac_data" as permissive for select to authenticated using (true);
drop policy if exists "cac_data update" on public."cac_data";
create policy "cac_data update" on public."cac_data" as permissive for update to authenticated using (true) with check (true);
drop policy if exists "breakeven delete" on public."breakeven_data";
create policy "breakeven delete" on public."breakeven_data" as permissive for delete to authenticated using (true);
drop policy if exists "breakeven insert" on public."breakeven_data";
create policy "breakeven insert" on public."breakeven_data" as permissive for insert to authenticated with check (true);
drop policy if exists "breakeven read" on public."breakeven_data";
create policy "breakeven read" on public."breakeven_data" as permissive for select to authenticated using (true);
drop policy if exists "breakeven update" on public."breakeven_data";
create policy "breakeven update" on public."breakeven_data" as permissive for update to authenticated using (true) with check (true);
drop policy if exists "metas delete" on public."metas_data";
create policy "metas delete" on public."metas_data" as permissive for delete to authenticated using (true);
drop policy if exists "metas insert" on public."metas_data";
create policy "metas insert" on public."metas_data" as permissive for insert to authenticated with check (true);
drop policy if exists "metas read" on public."metas_data";
create policy "metas read" on public."metas_data" as permissive for select to authenticated using (true);
drop policy if exists "metas update" on public."metas_data";
create policy "metas update" on public."metas_data" as permissive for update to authenticated using (true) with check (true);
drop policy if exists "pace insert" on public."pace_data";
create policy "pace insert" on public."pace_data" as permissive for insert to authenticated with check (true);
drop policy if exists "pace read" on public."pace_data";
create policy "pace read" on public."pace_data" as permissive for select to authenticated using (true);
drop policy if exists "pace update" on public."pace_data";
create policy "pace update" on public."pace_data" as permissive for update to authenticated using (true) with check (true);
drop policy if exists "realizado insert" on public."realizado_data";
create policy "realizado insert" on public."realizado_data" as permissive for insert to authenticated with check (true);
drop policy if exists "realizado read" on public."realizado_data";
create policy "realizado read" on public."realizado_data" as permissive for select to authenticated using (true);
drop policy if exists "realizado update" on public."realizado_data";
create policy "realizado update" on public."realizado_data" as permissive for update to authenticated using (true) with check (true);

-- Bucket publico das fotos dos vendedores
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- ---------- Aba "Ano" (Configuracoes): realizado anual por BU ----------
-- 1 linha por BU + ano + mes, so totais (sem categorias nem metas).
-- A carga dos dados do painel antigo esta em supabase/migrate-realizado-ano.sql.
create table if not exists public.year_realizado (
  bu             text    not null check (bu in ('cppem', 'unicive', 'colegio_cppem')),
  year           integer not null check (year between 2024 and 2100),
  month          integer not null check (month between 1 and 12),
  receita        numeric(14,2) not null default 0,
  qtd            integer not null default 0,
  leads_pago     integer not null default 0,
  leads_organico integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (bu, year, month)
);
alter table public.year_realizado enable row level security;
