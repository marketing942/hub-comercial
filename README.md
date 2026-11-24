# Hub de Receita

Sistema interno de gestão de vendas das BUs **CPPEM** e **Unicive**.
Painel gamificado com metas mensais, comparação meta × realizado em tempo real,
ranking de vendedores, frase motivacional diária e dashboards rápidos.

Stack: **Next.js 14 (App Router) + Tailwind + Supabase**, pronto pra publicar na **Vercel**.

---

## 1. Subir banco no Supabase

1. Crie um projeto novo em [supabase.com](https://supabase.com/).
2. No **SQL Editor**, cole e execute o arquivo `supabase/schema.sql`.
3. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` *(secret — só backend)*

> **Importante:** RLS fica desligado de propósito. Toda escrita passa pelas rotas
> `/api/*` do Next, que usam a `service_role`. O front nunca conversa direto com
> o Supabase — quem protege são as chaves de acesso (`ADMIN_PASSWORD` /
> `SELLER_PASSWORD`).

## 2. Variáveis de ambiente

Copie `.env.local.example` → `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=sua-senha-do-admin
SELLER_PASSWORD=senha-unica-pros-vendedores
SESSION_SECRET=string-grande-aleatoria
```

Na Vercel, configure as mesmas variáveis em **Project Settings → Environment Variables**.

## 3. Rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## 4. Publicar na Vercel

```bash
npx vercel
```

Ou conecte o repositório em vercel.com e defina as envs.

---

## Como funciona

### Acessos
- **Admin** entra com `ADMIN_PASSWORD` → painel `/admin` (vendedores, metas, leads, visão geral).
- **Vendedor** entra com `SELLER_PASSWORD` (chave única) e escolhe seu nome na
  tela seguinte. A escolha fica gravada num cookie assinado e ele cai em
  `/seller` (Meu Painel) ou `/dashboard` (público).

### O que o admin faz
- **Vendedores:** cria, renomeia, troca de BU, ativa/desativa, remove.
- **Metas:** por vendedor / mês:
  - Metas por linha de produto (faturamento + quantidade).
  - Ticket médio meta + Taxa de conversão meta.
  - CPPEM: Mentorias, Cursos/Materiais Digitais, Físicos, Turma PMAL, Turma PMPE, Turma Carreiras Policiais.
  - Unicive: Matrículas (faturamento + quantidade).
- **Leads:** preenche diariamente quantos leads cada vendedor recebeu.
  Entra no cálculo de taxa de conversão.

### O que o vendedor faz
- Lança e edita as **próprias vendas** (linha de produto, valor, quantidade).
- Vê o próprio painel com: % sucesso, meta, real, falta, ticket meta/real,
  conversão meta/real, leads recebidos e meta do dia.
- Vê o dashboard público (ranking, totais por BU, frase do dia).
- **Não pode** mexer em metas nem em leads.

### Métricas calculadas automaticamente
- **Meta principal**: CPPEM = soma dos faturamentos das linhas de produto.
  Unicive = soma da quantidade de matrículas.
- **% sucesso** = realizado / meta principal.
- **Meta do dia** = (meta − realizado) ÷ dias restantes do mês (incluindo hoje).
- **Ticket médio real** = soma de valor ÷ soma de quantidade.
- **Taxa de conversão real** = nº de vendas ÷ nº de leads × 100.
- **Frase motivacional** muda 1× por dia (seed pela data).

---

## Estrutura

```
src/
  app/
    api/        # rotas REST (auth, sellers, goals, leads, sales)
    login/      # tela de login (escolhe perfil + senha)
    escolher-vendedor/  # vendedor escolhe seu nome
    dashboard/  # dashboard público gamificado
    admin/      # painel do administrador
    seller/     # painel do vendedor
  components/   # UI compartilhada
  lib/          # supabase, auth, cálculos, dados
  middleware.ts # protege rotas privadas
supabase/
  schema.sql    # tabelas e seed
```
