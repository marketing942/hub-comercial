-- =====================================================================
-- Hub de Receita - Habilitar Row Level Security (defesa em profundidade)
-- Rodar UMA VEZ no SQL Editor do Supabase.
--
-- Modelo de acesso: TODO acesso ao banco passa pelas rotas /api do Next,
-- que usam a chave service_role. A service_role IGNORA RLS por design.
-- Ao ligar RLS SEM criar policies para anon/authenticated, garantimos que
-- as chaves publicas (anon) NAO conseguem ler nem escrever nada direto no
-- PostgREST, mesmo que a anon key vaze. So o backend (service_role) acessa.
-- =====================================================================

alter table public.sellers             enable row level security;
alter table public.monthly_goals       enable row level security;
alter table public.product_goals       enable row level security;
alter table public.bu_product_goals    enable row level security;
alter table public.bu_meta             enable row level security;
alter table public.daily_leads         enable row level security;
alter table public.sales               enable row level security;
alter table public.direct_sales        enable row level security;
alter table public.direct_visits       enable row level security;
alter table public.motivational_quotes enable row level security;

-- Revoga grants amplos das roles publicas (opcional, reforca o bloqueio).
-- A service_role e superusuaria do PostgREST e nao e afetada.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Confira que nenhuma tabela ficou com RLS desligado:
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r';
