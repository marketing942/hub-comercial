-- Matriculas do Colegio por serie, para o proximo ano letivo. Idempotente.
-- Preenchido em Configuracoes -> Colegio (sempre o total ate o momento).
create table if not exists public.colegio_matriculas (
  ano          integer not null,                 -- ano letivo de destino (ex.: 2027)
  serie        text not null,                    -- ef1..ef9, em1..em3
  alunos_hoje  integer not null default 0 check (alunos_hoje >= 0),
  rematriculas integer not null default 0 check (rematriculas >= 0),
  desistencias integer not null default 0 check (desistencias >= 0),
  novas        integer not null default 0 check (novas >= 0),
  updated_at   timestamptz not null default now(),
  primary key (ano, serie)
);
alter table public.colegio_matriculas enable row level security;
