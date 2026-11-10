-- Integração com o Conta Azul: token, espelho, mapa de classificação e a
-- receita do grupo que não é de vendedor nenhum.
--
-- NADA aqui toca o que já existe. Todas as tabelas são novas; a única alteração
-- em tabela existente é a troca de um índice (ver a nota em `sales_ca_item_uniq`
-- mais abaixo), que não muda uma linha de dado.
--
-- Idempotente — pode rodar de novo sem efeito.

-- ---------------------------------------------------------------------------
-- 1. Conexão OAuth (uma linha). O token do Cognito expira em ~1h e é renovado
--    pelo refresh_token, então precisa de ESCRITA — por isso vive no banco e
--    não em variável de ambiente.
-- ---------------------------------------------------------------------------
create table if not exists public.ca_conexao (
  id            boolean primary key default true check (id),  -- trava: uma linha só
  access_token  text not null,
  refresh_token text,
  token_type    text,
  scope         text,
  expires_at    timestamptz,
  conectado_em  timestamptz not null default now(),
  conectado_por text,
  atualizado_em timestamptz not null default now()
);
alter table public.ca_conexao enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Espelho das vendas do Conta Azul.
--
-- Por que espelhar em vez de ler ao vivo: a lista de vendas NÃO traz vendedor
-- nem categoria nem itens — isso só existe no detalhe, uma chamada por venda.
-- Com o limite de 10 req/s do CA, um mês custa minutos. Nenhuma tela pode
-- depender disso; o espelho é lido em milissegundos e o sync roda por fora.
-- ---------------------------------------------------------------------------
create table if not exists public.ca_vendas (
  ca_id           text primary key,
  numero          bigint,
  data            date,
  situacao        text,                 -- Faturado | Aprovado | Cancelado ...
  total           numeric(14,2),
  versao          integer,              -- muda quando a venda muda: a chave do incremental
  cliente_ca_id   text,
  ca_criado_em    timestamptz,
  ca_alterado_em  timestamptz,
  -- do detalhe
  vendedor_ca_id  text,
  vendedor_nome   text,
  categoria_ca_id text,
  detalhe_versao  integer,              -- `versao` lida quando o detalhe foi buscado
  detalhe_em      timestamptz,
  visto_em        timestamptz not null default now()
);
create index if not exists ca_vendas_data_idx      on public.ca_vendas (data);
create index if not exists ca_vendas_categoria_idx on public.ca_vendas (categoria_ca_id);
create index if not exists ca_vendas_vendedor_idx  on public.ca_vendas (vendedor_ca_id);
alter table public.ca_vendas enable row level security;

create table if not exists public.ca_venda_itens (
  ca_id       text primary key,         -- id da LINHA do item dentro da venda
  venda_ca_id text not null,
  item_ca_id  text,                     -- produto/serviço do catálogo
  nome        text,
  tipo        text,                     -- PRODUTO | SERVICO
  quantidade  numeric(14,4),
  valor       numeric(14,2)
);
create index if not exists ca_venda_itens_venda_idx on public.ca_venda_itens (venda_ca_id);
create index if not exists ca_venda_itens_item_idx  on public.ca_venda_itens (item_ca_id);
alter table public.ca_venda_itens enable row level security;

-- Estado de cada rodada do sync. Os contadores não são enfeite: um sync que
-- "deu certo" lendo zero vendas é o modo de falha mais comum e mais silencioso
-- dessas integrações, e é o contador que o denuncia.
create table if not exists public.ca_sync (
  recurso      text primary key,        -- vendas | detalhes | normalizacao
  iniciado_em  timestamptz,
  concluido_em timestamptz,
  lidos        integer,
  gravados     integer,
  erro         text,
  resumo       jsonb
);
alter table public.ca_sync enable row level security;

-- ---------------------------------------------------------------------------
-- 3. O mapa: catálogo do Conta Azul → linha de receita do Hub.
--
-- A chave é a CATEGORIA da venda (`1.5 - MATRÍCULA UNICIVE`), que já separa
-- matrícula de mensalidade. O ITEM entra em dois casos: venda sem categoria
-- (acontece em toda venda que nasce no site) e matrícula do Colégio, onde a
-- série só aparece no nome do item.
-- ---------------------------------------------------------------------------
create table if not exists public.ca_mapa_receita (
  ca_tipo          text not null check (ca_tipo in ('categoria', 'item')),
  ca_id            text not null,       -- ca_categoria_id ou item_ca_id. NUNCA o código "1.5"
  ca_nome          text,                -- como o CA chama; só para a tela
  bu               text check (bu in ('cppem', 'unicive', 'colegio_cppem')),
  product_line     text,                -- linha de receita; null = não classificado
  -- A regra do requisitante numa coluna: só a matrícula conta para o vendedor.
  -- Default FALSE de propósito — item novo não creditado se percebe (o vendedor
  -- reclama); creditado por engano vira comissão paga.
  conta_vendedor   boolean not null default false,
  ignorar          boolean not null default false,  -- frete, multa, estorno
  classificado_em  timestamptz,
  classificado_por text,
  visto_em         timestamptz not null default now(),
  primary key (ca_tipo, ca_id)
);
alter table public.ca_mapa_receita enable row level security;

-- Vendedor do Conta Azul → vendedor do Hub. N:1 de propósito: um cadastro
-- refeito no CA gera um id novo e o histórico só fecha se os dois apontarem
-- para a mesma pessoa.
create table if not exists public.ca_vendedores (
  ca_vendedor_id text primary key,
  ca_nome        text,
  -- vendedor     = vai para `sales` com seller_id
  -- canal_direto = vai para `direct_sales` (venda de site, sem dono)
  -- grupo        = vai para `ca_receita` (diretoria, administrativo, quem saiu)
  -- pendente     = default: não credita ninguém até alguém dizer o que é
  destino        text not null default 'pendente'
    check (destino in ('vendedor', 'canal_direto', 'grupo', 'pendente')),
  seller_id      uuid references public.sellers(id) on delete set null,
  visto_em       timestamptz not null default now()
);
create index if not exists ca_vendedores_destino_idx on public.ca_vendedores (destino);
alter table public.ca_vendedores enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Receita do grupo que não é de vendedor nenhum (mensalidade, repasse,
--    fardamento, e o que foi lançado por diretoria/administrativo).
--
--    Fica FORA de `sales` de propósito: assim é impossível um `where` esquecido
--    inflar o ranking de alguém com R$ 60 mil/mês de mensalidade.
-- ---------------------------------------------------------------------------
create table if not exists public.ca_receita (
  ca_venda_id    text not null,
  ca_item_id     text not null,
  sale_date      date not null,
  bu             text,
  product_line   text,
  valor          numeric(14,2) not null default 0,
  quantidade     numeric(14,4) not null default 1,
  -- true = a linha CONTA para vendedor, mas a venda chegou sem vendedor
  -- mapeado: é a "venda sem dono", que a barra de meta mostra em alerta.
  conta_vendedor boolean not null default false,
  cliente_ca_id  text,
  vendedor_ca_id text,                  -- auditoria: quem lançou. Nunca crédito.
  ca_versao      integer,
  primary key (ca_venda_id, ca_item_id)
);
create index if not exists ca_receita_data_idx  on public.ca_receita (sale_date);
create index if not exists ca_receita_linha_idx on public.ca_receita (bu, product_line, sale_date);
alter table public.ca_receita enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Troca do índice de idempotência em `sales`.
--
-- A `ca-01` criou um índice único PARCIAL (`where origem = 'conta_azul'`).
-- Índice parcial não serve para `ON CONFLICT` via PostgREST: o Postgres só o usa
-- quando a instrução repete o predicado, e o cliente não expõe isso. Trocado por
-- um índice completo — que é seguro porque as linhas manuais têm
-- `ca_venda_id`/`ca_item_id` NULOS, e no Postgres NULL é distinto de NULL por
-- padrão (NULLS DISTINCT): nenhuma linha manual colide com outra.
--
-- Nenhum dado é alterado por isto.
-- ---------------------------------------------------------------------------
drop index if exists public.sales_ca_item_uniq;
create unique index if not exists sales_ca_item_uniq
  on public.sales (ca_venda_id, ca_item_id);

drop index if exists public.direct_sales_ca_item_uniq;
create unique index if not exists direct_sales_ca_item_uniq
  on public.direct_sales (ca_venda_id, ca_item_id);
