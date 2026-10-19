-- =====================================================================
-- EXPORTA o realizado anual do PAINEL ANTIGO (Dashboard-Marketing) em forma
-- de SQL pronto pro Hub.
--
-- COMO USAR
--   1) Abra o SQL Editor do Supabase do PAINEL ANTIGO e rode esta consulta.
--   2) O resultado e UMA unica celula (coluna sql_para_o_hub). Copie TODO o
--      conteudo dela.
--   3) Abra o SQL Editor do Supabase do HUB e cole/rode. Ele cria a tabela
--      year_realizado (se ainda nao existir) e insere os dados. Pode rodar mais
--      de uma vez: nao duplica e nao sobrescreve o que voce editou na aba Ano.
--
-- Se o resultado vier NULL/vazio, o painel antigo nao tem realizado preenchido.
--
-- O que leva: so totais por mes (receita = soma dos canais, qtd, leads pagos e
-- organicos). NAO leva categorias, metas, mensalidade, CAC nem breakeven.
-- Mapeamento: cppem -> cppem | unicv -> unicive | colegio -> colegio_cppem
-- =====================================================================
select
  $ddl$create table if not exists public.year_realizado (
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

$ddl$
  || 'insert into public.year_realizado (bu, year, month, receita, qtd, leads_pago, leads_organico) values' || E'\n' ||
  string_agg(
    format('(%L, %s, %s, %s, %s, %s, %s)', t.bu, t.year, t.month, t.receita, t.qtd, t.leads_pago, t.leads_organico),
    E',\n' order by t.bu, t.year, t.month
  ) || E'\n' || 'on conflict (bu, year, month) do nothing;' as sql_para_o_hub
from (
  select
    case r.product when 'unicv' then 'unicive' when 'colegio' then 'colegio_cppem' else r.product end as bu,
    r.year,
    m.n as month,
    round(coalesce((
      select sum(coalesce((ch.value ->> (m.n - 1))::numeric, 0))
      from jsonb_each(case when jsonb_typeof(r.data -> 'channels') = 'object' then r.data -> 'channels' else '{}'::jsonb end) as ch
    ), 0), 2) as receita,
    round(coalesce((r.data -> 'qtd' ->> (m.n - 1))::numeric, 0))::int as qtd,
    round(coalesce((coalesce(r.data -> 'leadsPago', r.data -> 'leads') ->> (m.n - 1))::numeric, 0))::int as leads_pago,
    round(coalesce((r.data -> 'leadsOrganico' ->> (m.n - 1))::numeric, 0))::int as leads_organico
  from public.realizado_data r
  cross join generate_series(1, 12) as m(n)
  where r.product in ('cppem', 'colegio', 'unicv') and r.year between 2024 and 2100
) t
where t.receita <> 0 or t.qtd <> 0 or t.leads_pago <> 0 or t.leads_organico <> 0;
