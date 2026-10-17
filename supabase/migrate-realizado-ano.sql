-- =====================================================================
-- ABA "ANO" (Configuracoes) — tabela de realizado anual por BU + migracao
-- do painel antigo (Dashboard-Marketing).
--
-- Rode este arquivo INTEIRO uma vez no SQL Editor do Supabase do Hub
-- (selecione tudo, Ctrl/Cmd+A, e clique Run). E idempotente: pode rodar de
-- novo sem duplicar nem sobrescrever o que voce editou na aba.
--
-- O que ele faz:
--   1) Cria public.year_realizado (1 linha por BU + ano + mes).
--   2) Se existir a tabela do painel antigo (public.realizado_data) e ela
--      tiver dados, copia SO os totais de cada mes:
--        - receita = soma de todos os canais/categorias do mes
--        - qtd de vendas
--        - leads pagos e leads organicos
--      NAO traz receita por categoria, NAO traz metas, NAO traz CAC/breakeven.
--   3) Mostra no final um resumo do que ficou na tabela nova.
--
-- Mapeamento das BUs do painel antigo -> Hub:
--   cppem -> cppem | unicv -> unicive | colegio -> colegio_cppem
--
-- Se o resumo final vier VAZIO, a tabela antiga nao tem dados neste banco:
-- me mande os numeros (ou digite direto na aba Ano) que eu carrego.
--
-- DIAGNOSTICO (opcional — cole sozinho, antes, se quiser ver o que existe):
--   select product, year, jsonb_pretty(data) from public.realizado_data order by 1, 2;
-- =====================================================================

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

do $$
begin
  if to_regclass('public.realizado_data') is null then
    raise notice 'Tabela realizado_data nao existe neste banco: nada a copiar.';
    return;
  end if;

  insert into public.year_realizado (bu, year, month, receita, qtd, leads_pago, leads_organico)
  select t.bu, t.year, t.month, t.receita, t.qtd, t.leads_pago, t.leads_organico
  from (
    select
      case r.product
        when 'unicv'   then 'unicive'
        when 'colegio' then 'colegio_cppem'
        else r.product
      end as bu,
      r.year,
      m.n as month,
      round(coalesce((
        select sum(coalesce((ch.value ->> (m.n - 1))::numeric, 0))
        from jsonb_each(
          case when jsonb_typeof(r.data -> 'channels') = 'object'
               then r.data -> 'channels'
               else '{}'::jsonb end
        ) as ch
      ), 0), 2) as receita,
      round(coalesce((r.data -> 'qtd' ->> (m.n - 1))::numeric, 0))::int as qtd,
      round(coalesce(
        (coalesce(r.data -> 'leadsPago', r.data -> 'leads') ->> (m.n - 1))::numeric, 0
      ))::int as leads_pago,
      round(coalesce((r.data -> 'leadsOrganico' ->> (m.n - 1))::numeric, 0))::int as leads_organico
    from public.realizado_data r
    cross join generate_series(1, 12) as m(n)
    where r.product in ('cppem', 'colegio', 'unicv')
      and r.year between 2024 and 2100
  ) t
  where t.receita <> 0 or t.qtd <> 0 or t.leads_pago <> 0 or t.leads_organico <> 0
  on conflict (bu, year, month) do nothing;
end $$;

-- Resumo do que ficou na tabela nova (vazio = nada foi migrado).
select bu, year,
       count(*)            as meses_com_dado,
       sum(receita)        as receita_total,
       sum(qtd)            as vendas,
       sum(leads_pago + leads_organico) as leads
from public.year_realizado
group by bu, year
order by bu, year;
