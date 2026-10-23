# Hub Comercial — guia de identidade visual e convenções

Leia isto antes de criar ou alterar qualquer tela. A identidade vigente é a **identidade CPPEM**
(carvão + dourado), introduzida no commit `62fbb9a`. O tema verde antigo foi abandonado.
Fonte da verdade: `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/brand.ts`.
Use sempre os tokens/classes abaixo; não escreva hex solto em componente novo.

## 1. Fontes (`src/app/layout.tsx`, via `next/font/google`)

| Papel | Fonte | Variável CSS | Classe Tailwind | Uso |
|---|---|---|---|---|
| Corpo | Inter | `--font-body` | `font-sans` (padrão do body) | texto corrido, tabelas |
| Display | Oxanium | `--font-display` | `font-display` | títulos `h1–h3` (automático), números grandes (`.big-num`, `.kpi-num`), logotipo |
| UI | Rajdhani (500/600/700) | `--font-ui` | `font-ui` | rótulos, botões, chips, abas, eyebrows — sempre **bold, MAIÚSCULAS, tracking aberto** |

## 2. Cores

**Superfícies e marca** (`tailwind.config.ts`):
`bg #0e0e14` (fundo) · `panel #14141b` · `panel2 #1b1b24` (inputs, células, botão ghost) ·
`border #3b3524` · `accent #c9ae7a` (dourado principal) · `accent2 #af9256`.

**Variáveis CSS** (`:root` em `globals.css`): `--gold #af9256`, `--gold-light #c9ae7a`,
`--gold-pale #f0dcb0`, `--gold-dark #8a7040`, `--text #e8e4d9`, `--text-soft #ada99b`,
`--text-muted #87847a`, `--hair rgba(201,174,122,.15)` (linha fina divisória — use `border-[var(--hair)]`).

**Fundo da página:** `#0e0e14` com dois brilhos dourados radiais fixos (canto sup. direito e inf. esquerdo).
Seleção de texto dourada; scrollbar fina com thumb dourado.

**Cores semânticas dos números** (`COLOR` em `src/lib/brand.ts`) — única paleta permitida para valores numéricos:

| Token | Hex | Significado |
|---|---|---|
| `COLOR.ok` | `#5fd08f` | bateu / superou / sucesso (`success`) |
| `COLOR.warning` | `#f0b44c` | meta / urgência / ritmo ideal (`warning`) |
| `COLOR.danger` | `#ee7d73` | atrasado (`danger`) |
| `COLOR.info` | `#74aee0` | informativo (ticket, leads) |
| `COLOR.gold` | `#c9ae7a` | em andamento |
| `COLOR.neutral` | `#e8e4d9` | número neutro (base: branco) |
| `COLOR.mute` | `#ada99b` | texto secundário |

Regras: branco = neutro · verde = bom · vermelho = ruim/atrasado · azul = só informativo.
Helpers: `tonePctMeta`, `toneVsMeta`, `toneInfoOrOk`.

**Cores por BU** (`BU_COLOR`, `BU_THEME`): CPPEM `#c9ae7a` (dourado, igual ao accent) · UNICIVE `#F5C518` ·
Colégio `#5B8FE0`. **Servem só para identidade** (chips `chip-cppem/-unicive/-colegio`, logos, brilhos de fundo,
barra/linha da série principal) — **nunca** para colorir um número de resultado.

## 3. Componentes base (classes em `globals.css`, `@layer components`)

- **`.card`** / **`.card-lg`** — painel escuro com gradiente diagonal `rgba(31,30,39)→rgba(18,18,24)`, brilho dourado no canto, realce interno superior. `rounded-2xl p-3`. Com `.card-hover` ganha borda/brilho dourado no hover.
- **`.panel`** — superfície chapada `#14141b`, borda `--hair`, raio 18px, sombra funda. Usado na barra do topo, dashboard das BUs, Vendedores e Direto/IA.
- **`.cell`** — célula de “faixa de indicadores” (borda esquerda+topo `--hair`). Padrão: `<section className="panel overflow-hidden"><div className="-ml-px -mt-px grid …">{cells}</div></section>` (ver `StatCell.tsx` e `Cell` em `DashboardView.tsx`).
- **`.eyebrow-label`** — título de seção: Rajdhani 12px bold maiúsculo, tracking .18em, dourado claro.
- **`.btn`** — `rounded-lg`, Rajdhani bold maiúsculo, tracking aberto. **`.btn-primary`** = gradiente dourado `#f0dcb0→#af9256→#8a7040`, texto `#16130c`, sobe 2px no hover. **`.btn-ghost`** = `panel2` + borda, hover borda dourada. **`.btn-danger`** = fundo `danger/15`. Botão-ícone compacto: `btn-ghost h-9 w-9 !p-0`.
- **`.input`** — `bg-panel2`, borda `border`, `rounded-lg`, foco com borda `accent`. **`.label`** — Rajdhani xs semibold maiúsculo, tracking .14em, `white/50`. Foco de teclado global: outline 2px `--gold-pale`.
- **`.chip`** — pílula Rajdhani bold maiúscula. **`.kpi-label`** (Rajdhani 11px maiúsculo) · **`.kpi-num`** / **`.big-num`** (Oxanium bold).
- **Aba/seletor em pílula** (switchers de BU, `ConfiguracoesSubnav`, wizard): contêiner `inline-flex p-1 rounded-xl bg-panel border border-border`; item ativo `bg-accent text-black`, inativo `text-white/60 hover:text-white`.
- **`ProgressBar`** — trilho `white/10`, preenchimento em gradiente `${cor}99→cor` com brilho; `rounded-full`.
- **`Avatar`** — quadrado arredondado (`rounded-2xl`) com anel `${cor}55`; fallback = iniciais sobre `${cor}33`.
- Outros: `BigStatCard`, `StatCard`, `StatCell`, `ProgressRing`, `OriginDonut`, `ProductRevenueBreakdown`, `LongTermGoalCard`, `PeriodNav`, `NumberField`, `BULogo`.

Raios: cartões `2xl`/18px · botões e inputs `lg` · contêineres de pílulas `xl` · chips e barras `full`.

## 4. Navegação e shell

- **Barra no topo** (não há sidebar; o arquivo `Sidebar.tsx` renderiza o `<header class="app-topbar">`): sticky `h-14`, `bg-bg/80 backdrop-blur-xl`, borda inferior `--hair`. Logo em texto “HUB **COMERCIAL**” (Oxanium, tracking .14em, “Comercial” em `accent`). Itens **só texto** (o prop `icon` existe por compatibilidade e é ignorado), Rajdhani bold maiúsculo 13px; ativo = texto `accent` + barra de 2px embaixo (`activePrefixes` marca sub-rotas como ativas).
- **Carrossel do Dashboard TV** (`DashboardCarousel`): abas das BUs com o mesmo sublinhado; sob a aba ativa corre uma barra dourada de contagem regressiva até o próximo slide; à direita período, relógio “Atualizado”, pausar, atualizar, tela cheia.
- **Configurações** (admin) = menu único com sub-abas em pílula (`ConfiguracoesSubnav`): Vendedores · Metas · Todas as Vendas · Comissões · Leads · Direto / IA · Ano.
- ⚠️ Os itens de navegação estão **duplicados em 3 layouts**: `src/app/admin/layout.tsx`, `src/app/dashboard/layout.tsx` e `src/app/seller/layout.tsx`. Ao criar/renomear aba, altere **todos** (e `activePrefixes`, e `TABS` do subnav se for sub-aba de Configurações).

## 5. Dashboard TV (modo TV)

- Fullscreen adiciona `html.tv-mode`: esconde `.app-topbar`, reduz `big-num`/`kpi-num` e compacta espaçamentos; abaixo de 900px/800px de altura reduz também a fonte-base (14px / 12.5px). **Tudo deve caber sem rolar em 768p.**
- Layout de cada BU (`DashboardView`): `LongTermGoalCard` no topo (se houver meta longa) → linha com `.panel` do placar (`ScoreRing` + `StatRow`s, 5/12) e `.panel` do gráfico de evolução (7/12) → faixa “ritmo” (`.panel` + `Cell`s: meta do dia, da semana, ticket, conversão, leads, com Pace/Projeção) → (Unicive: 2ª faixa de matrículas) → Receita por categoria.
- Gráfico (`UnifiedDailyChart`, Recharts `ComposedChart`): grade `#2d2c3a`, eixos `#87847a`, série principal na cor da BU, leads em `COLOR.info`, % meta na cor semântica, ideal tracejado `#f0b44c`; tooltip próprio (`#14141b`, borda `#4a4230`, título dourado maiúsculo, diferença p.p. vs ritmo ideal).
- Números nunca podem estourar o card: use `truncate`, `clamp()` (como `StatCell`) ou reduza a fonte.
- Notificação de venda nova (`NewSaleNotifier`): toast no canto sup. direito, fundo dourado translúcido com `backdrop-blur`, ícone de troféu em `success`, ~8s, botão X; buzina Web Audio sintetizada em `src/lib/airHorn.ts` (desbloqueia no primeiro gesto do usuário).
- **Meu Painel do vendedor** (`src/app/seller/page.tsx`): mesmo desenho do dash da BU — `.panel` à esquerda com faixa de `Cell`s (meta + barra, meta do dia, realizado hoje, Pace, Projeção, ticket, conversão, leads) e `.panel` à direita com `UnifiedDailyChart` das vendas **do próprio vendedor** (`sellerSeries` em `src/lib/data.ts`; % da meta individual vs ritmo ideal). Faturamento do card vem de `stats.valorRealizado/valorMeta` (do vendedor), não da BU.
- Perfis: admin vê todos os slides (inclui Direto/IA); vendedor vê só os slides das próprias BUs + “Vendedores”.

## 6. Padrões de UX que o time aprovou

- **Lançar algo = modal central em passos** (stepper numerado, Voltar/Avançar, último passo já grava, **sem tela de confirmação**): `NewSaleModal`, `NewDiretoSaleModal`, `VisitsModal`. Overlay `bg-black/70 backdrop-blur-sm`, caixa `bg-panel border border-border rounded-2xl shadow-glow`, fecha com ESC/clique fora.
- **Gestão = tabela plana com filtros em cima** (busca, BU, status) e colunas de ação; sem avatar de iniciais (ver `admin/sellers/sellers-client.tsx`).
- **Compacto na vertical**: cards baixos, pouco padding, sem ícones decorativos, cabeçalhos de página enxutos.
- Datas sempre no fuso de Recife (`todayISORecife`, `nowRecife`); nunca `toISOString()` para “hoje”. Não aceitar data futura em vendas.
- Textos de UI em português; historicamente **sem acentos** nas strings (há exceções recentes, ex.: “Gestão”) — siga o que o arquivo já usa.

## 6.1 Aba “Ano” (Configurações → Ano)

- Planilha de **realizado anual por BU** (CPPEM · UNICIVE · Colégio), 12 meses + total do ano, com auto-save por mês (debounce 700 ms; grava o pendente ao trocar de ano/sair). Só **totais**: receita, qtd de vendas, leads pagos, leads orgânicos; ticket médio e conversão são calculados. **Sem receita por categoria e sem metas** (decisão do time). Independente das vendas lançadas no Hub (entrada manual).
- Código: `src/app/admin/ano/` (página servidor + `ano-client.tsx`), `src/app/api/year/route.ts` (POST, só admin, valida e arredonda), `src/lib/yearMath.ts` (tipos/cálculos **puros**, seguros para o cliente) e `src/lib/yearRealizado.ts` (leitura no servidor; degrada para “tabela ainda não criada” se faltar a tabela).
- Banco: tabela `year_realizado (bu, year, month, receita, qtd, leads_pago, leads_organico)` com PK `(bu, year, month)`, BUs no padrão do Hub (`cppem`/`unicive`/`colegio_cppem`). A carga dos dados do painel antigo (Dashboard-Marketing → `realizado_data`; `unicv`→`unicive`, `colegio`→`colegio_cppem`) está em `supabase/migrate-realizado-ano.sql` (idempotente, não sobrescreve edições).
- ⚠️ Nunca importar `lib/supabase.ts` (service_role) em componente de cliente: tipos/cálculos usados no navegador vão em arquivo separado, como `yearMath.ts`.
- ⚠️ **Router Cache do Next 14**: ao voltar para `/admin/ano` por `<Link>` (~30 s) o Next reaproveita o payload antigo da página, então `initialGrid` vem velho (e `useState(initialGrid)` nunca atualiza). Por isso `ano-client.tsx` busca `GET /api/year?year=…` (no-store, só admin) ao montar e ao voltar o foco/visibilidade da janela, e mantém os inputs **travados até chegar o dado fresco** (evita gravar a linha do mês com campos zerados a partir de estado velho). Não atualiza se houver edição pendente. Vale para qualquer planilha editável nova: não confie só nas props do servidor.
- ⚠️ Em `next dev` as páginas **não hidratam** (a CSP do projeto bloqueia `unsafe-eval`). Para testar UI use `next build && next start`.
- As tabelas do painel antigo (`cac_data`, `breakeven_data`, `metas_data`, `pace_data`, `realizado_data`) continuam no banco mas **não são usadas pelo Hub**; CAC e breakeven foram descartados.

## 6.2 Mobile (<640px, breakpoint `sm` do Tailwind)

- Alvos de toque ≥ 44px: em `globals.css` (bloco "Mobile") `.btn` ganha `min-height: 2.75rem` e os botões-ícone `h-8/h-9` viram 44px; `.input`/`select` usam fonte 16px (evita o zoom do iOS). Não use `h-8`/`h-9` fixos achando que valem no celular — o CSS sobrepõe.
- **Tabela → cartões**: coloque `className="table-stack …"` na `<table>` e `data-label="Rótulo"` em cada `<td>` (vazio `""` para a coluna de ações). No celular o `thead` some e cada `<tr>` vira um cartão "rótulo … valor". Aplicado em Todas as Vendas, Vendedores, Direto/IA, Comissões (resumo), Leads e Minhas Vendas. Tabelas largas de planilha (aba Ano) continuam com rolagem horizontal + 1ª coluna fixa.
- `ConfiguracoesSubnav` é uma linha única rolável (`no-scrollbar`) que centraliza a aba ativa; fica `sticky top-14` (abaixo da barra do topo).
- Aviso de venda nova: largura total e no máximo 2 empilhados no celular (`.sale-toasts`). Tela cheia (TV) fica escondida no celular. Gráfico diário vai a 300px de altura (`max-sm:!h-[300px]`).
- Teste mobile: `next build && next start` + Playwright com `isMobile`/`hasTouch` e viewport 390×844; confira também `scrollWidth <= clientWidth` (sem rolagem horizontal da página).

## 7. Pendências de identidade (não bloqueiam)

- `src/app/icon.svg`: troféu dourado correto, mas as alças ainda estão em lima `#a3e635` (resquício do tema antigo).
- `avatar_color` padrão `#22c55e` em `src/app/api/sellers/route.ts` (e default da coluna no `schema.sql`).

## 8. Fluxo de trabalho neste repositório

- Branch de desenvolvimento: `claude/nifty-ramanujan-y9xwiu` (Vercel faz deploy do push). Outra sessão também empurra nela: faça `git fetch`/`git pull --rebase` antes de começar e antes de dar push.
- Verifique tipos com `npx tsc --noEmit` antes de commitar.
- Mudança de banco: manter `supabase/schema.sql` **idempotente** (`if not exists`, `drop … if exists`) e, para ajustes pontuais, criar um snippet SQL curto em `supabase/` — o usuário roda no SQL Editor do Supabase. Nunca presumir que a coluna nova já existe: as queries devem degradar sem derrubar a tela (vide `listSellers`).
- Segurança: `service_role` só no servidor; escritas passam por `/api/*`; login único por chave (admin = `ADMIN_PASSWORD`; vendedor = `sellers.password_hash`).
