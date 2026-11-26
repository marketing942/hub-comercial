# Hub de Receita — guia (o sistema se chamava “Hub Comercial”; o domínio/repositório `hub-comercial` continua o mesmo) de identidade visual e convenções

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
`bg #0e0e14` (fundo) · `panel #111117` (mais escuro desde 26/11/2026; `.panel` usa a mesma cor) · `panel2 #1b1b24` (inputs, células, botão ghost) ·
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
- **`.panel`** — superfície chapada `#14141b`, borda `--hair`, raio 18px, sombra funda. Usado na barra do topo, dashboard das BUs e Vendedores.
- **`.cell`** — célula de “faixa de indicadores” (borda esquerda+topo `--hair`). Padrão: `<section className="panel overflow-hidden"><div className="-ml-px -mt-px grid …">{cells}</div></section>` (ver `StatCell.tsx` e `Cell` em `DashboardView.tsx`).
- **`.eyebrow-label`** — título de seção: Rajdhani 12px bold maiúsculo, tracking .18em, dourado claro.
- **`.btn`** — `rounded-lg`, Rajdhani bold maiúsculo, tracking aberto. **`.btn-primary`** = gradiente dourado `#f0dcb0→#af9256→#8a7040`, texto `#16130c`, sobe 2px no hover. **`.btn-ghost`** = `panel2` + borda, hover borda dourada. **`.btn-danger`** = fundo `danger/15`. Botão-ícone compacto: `btn-ghost h-9 w-9 !p-0`.
- **`.input`** — `bg-panel2`, borda `border`, `rounded-lg`, foco com borda `accent`. **`.label`** — Rajdhani xs semibold maiúsculo, tracking .14em, `white/50`. Foco de teclado global: outline 2px `--gold-pale`.
- **`.chip`** — pílula Rajdhani bold maiúscula. **`.kpi-label`** (Rajdhani 11px maiúsculo) · **`.kpi-num`** / **`.big-num`** (Oxanium bold).
- **Aba/seletor em pílula** (switchers de BU, `ConfiguracoesSubnav`, wizard): contêiner `inline-flex p-1 rounded-xl bg-panel border border-border`; item ativo `bg-accent text-black`, inativo `text-white/60 hover:text-white`.
- **`ProgressBar`** — trilho `white/10`, preenchimento em gradiente `${cor}99→cor` com brilho; `rounded-full`.
- **`Avatar`** — quadrado arredondado (`rounded-2xl`) com anel `${cor}55`; fallback = iniciais sobre `${cor}33`.
- **`Indicador`** (`components/Indicador.tsx`) — célula PADRÃO das faixas de indicadores (painéis das BUs e “Minha meta” do Meu Painel): rótulo → número principal = **realizado**, o único com cor (verde = bateu/no ritmo, vermelho = atrás, branco = em andamento/sem meta) → linhas “rótulo … valor” sem cor (meta, falta, pace, projeção). **Sem barra de progresso** nessas células.
- Outros: `StatCell`, `BarraBala` (GAV), `DuasBarras` (detalhe do Direto), `PeriodNav`, `NumberField`, `BULogo`.

Raios: cartões **6px** (`.panel`, `.card`, `.card-lg`, modais; mais quadrados desde 26/11/2026). Espaço entre cards dos painéis: `gap-2`/`space-y-2` (mais juntos desde 26/11/2026) · botões e inputs `lg` · contêineres de pílulas `xl` · chips e barras `full`.

## 4. Navegação e shell

- **Barra no topo** (não há sidebar; o arquivo `Sidebar.tsx` renderiza o `<header class="app-topbar">`): sticky `h-14`, `bg-bg/80 backdrop-blur-xl`, borda inferior `--hair`. Logo em texto “HUB DE **RECEITA**” (Oxanium, tracking .14em, “Receita” em `accent`). Itens **só texto** (o prop `icon` existe por compatibilidade e é ignorado), Rajdhani bold maiúsculo 13px; ativo = texto `accent` + barra de 2px embaixo (`activePrefixes` marca sub-rotas como ativas).
- **Carrossel do Dashboard TV** (`DashboardCarousel`): abas das BUs com o mesmo sublinhado; sob a aba ativa corre uma barra dourada de contagem regressiva até o próximo slide; à direita período, relógio “Atualizado”, pausar, atualizar, tela cheia.
- **Menu (desde 25/11/2026)**: um item só, **Gestão à Vista** (`/dashboard`, o carrossel). Para o vendedor, também **Meu Painel** (que absorveu a Gamificação em 25/11/2026; `/seller/gamification` só redireciona). **Configurações** (admin) é a **engrenagem ao lado do Sair** (`Sidebar.tsx`, `CONFIG_PREFIXES`), e abre as sub-abas em pílula (`ConfiguracoesSubnav`): Vendedores · Metas · Comissões · Leads · Colégio · Ano · Classificação. O **1º slide do carrossel é o GAV** (`components/gav/GavPainel.tsx`, só admin, entra na rotação): receita da empresa × **meta total** (soma de `ca_metas_linha` de todas as BUs), **GAV v2 (25/11/2026, refeito porque o time não gostou do anterior)** em 3 faixas: (1) linha de cima: card **“Receita CPPEM Educação”** (sem selo) = Realizado · Meta · Gap/Superávit · % da meta numa linha (números grandes, só o % com cor) e, embaixo, as **3 origens em barras segmentadas lado a lado** (“Direto” tem o link “detalhes ›” do modal) | **Por BU** em barras segmentadas (sem barrinha de cor); (2) **um card só** com o “Acumulado × ritmo da meta” (`UnifiedDailyChart`, o mesmo da Evolução diária) em cima e as **Linhas de receita** embaixo, grade de 4 numa **ordem fixa** (`ORDEM_LINHAS` em `GavPainel.tsx`: Mentorias, Turmas presenciais, Cursos online, Materiais digitais, Materiais físicos, Supletivo, Matrícula UNICIVE, Repasse mensalidade, Matrícula Colégio, Mensalidade, Fardamento, Eventos, Multas; o que não casar vai para o fim), nome em branco forte, BU = **barrinha vertical na cor da BU** do nome até a barra (`COR_BU` do GAV: CPPEM dourado `#c9ae7a`, **UNICIVE verde `#3fbf8a`**, Colégio azul `#5B8FE0`; o `BU_COLOR` dos outros painéis não mudou). Fatias (% da receita total / da BU) ficam na **dica (i)** (`gav/Dica.tsx`, abre ao tocar ou com o mouse). Todas as barras são a **barra segmentada** (ver “GAV — barras segmentadas” abaixo), sem trilho/sombra. Cor do resultado (`tomRitmo`) vai só no número/%. "Atualizado" do carrossel = horário do último envio do Conta Azul (`ca_sync.vendas.concluido_em`), NÃO o relógio. Sem filtros: o período é o do carrossel. `/admin/gav` e `/admin/gav/gestao` só redirecionam para `/dashboard`; `/admin/gav/conexao` continua (link "sync" no rodapé do GAV). Dados: `gestaoDoMes` em `src/lib/gestaoAVista.ts` (traz `metaTotal`, `metaPorBu`, `porBu`). **Linha de receita = categoria do Conta Azul**: a tela lê só `ca_linha_receita` (uma linha por item válido do Conta Azul, com categoria do CA, BU e origem vendedores/direto/diretoria — na tela a origem `diretoria` se chama **Pós-venda** (`ORIGEM_ROTULO`; mensalidades, boletos de turma já vendida, multas, reforço, livros: receita que não é venda nova); a chave no banco continua `diretoria`; gravada por `normalizarJanela`; SQL `supabase/ca-03-linha-receita.sql`) — ver `src/lib/gestaoAVista.ts`. A **Classificação** ficou assim: *Categorias* = só BU + “conta para o vendedor” + ignorar (salva sozinha); *Itens* = avançado (só o dashboard antigo por linha). **Metas (etapa 2, unificada)**: Configurações → *Metas* (`/admin/goals`) é UMA tela em 3 seções — 1 meta total da BU (soma das linhas que contam p/ vendedor + leads/conversão), 2 meta por linha de receita (tabela `ca_metas_linha`, SQL `supabase/ca-04-metas-linha.sql`, uma meta R$/qtd por categoria do Conta Azul) e 3 meta por vendedor (`monthly_goals`); um botão salva tudo (`/admin/metas-linha` só redireciona); “Usar metas antigas” converte `bu_product_goals` (as 12 séries do Colégio somam em Matrícula). A Gestão à Vista (GAV) usa essas metas. **A receita por linha/categoria fica só no GAV** (25/11/2026): os painéis das BUs não têm mais o card “Receita por categoria” (`ReceitaCategoriasCA`/`ProductRevenueBreakdown` foram apagados e o `dashboardSnapshot` não lê mais categorias, ligação nem indicação). **Etapa 3**: com dado em `ca_linha_receita` no mês (e fonte `conta_azul`), BU (`buSeries`), vendedores/comissões/Meu Painel (`statsForAll`, `sellerMonthRaw`) leem a receita **das categorias do Conta Azul** (origem `vendedores`/`direto`, BU da categoria) — não dependem mais de a linha ter sido ligada a uma linha do Hub; a meta geral da BU vira a soma das metas por linha **só das categorias que contam p/ vendedor** (`metaGeralDaBu`; sem meta por linha, vale a antiga). Metas **individuais** dos vendedores (`monthly_goals`) e as regras de comissão não mudaram. Mês sem dado em `ca_linha_receita` cai no caminho antigo. ⚠️ O Hub só recebe do Jarvis as **vendas** (`ca_vendas` + itens) e o cadastro de categorias: receita do Conta Azul que **não é venda** (ex.: repasse de mensalidade lançado só no financeiro) só entra na Gestão a Vista se o Jarvis passar a empurrá-la; (a antiga conferência “Conta Azul × esta tela” saiu do GAV junto com a leitura de `ca_vendas` que ela exigia). Toda categoria de receita (código `1…`) aparece na Classificação, mesmo sem venda na janela. Na Classificação, as linhas só-do-grupo (Repasse Unicive, Mensalidade/Eventos/Reforço/Livros do Colégio) agora são selecionáveis (com “Conta para o vendedor” desmarcado).
- ⚠️ Os itens de navegação estão **duplicados em 3 layouts** (a engrenagem não: está no `Sidebar.tsx`): `src/app/admin/layout.tsx`, `src/app/dashboard/layout.tsx` e `src/app/seller/layout.tsx`. Ao criar/renomear aba, altere **todos** (e `activePrefixes`, e `TABS` do subnav se for sub-aba de Configurações).

## 5. Dashboard TV (modo TV)

- Fullscreen adiciona `html.tv-mode`: esconde `.app-topbar`, reduz `big-num`/`kpi-num` e compacta espaçamentos; abaixo de 900px/800px de altura reduz também a fonte-base (14px / 12.5px). **Tudo deve caber sem rolar em 768p.**
- Layout de cada BU (`DashboardView`) (a meta de longo prazo de matrículas do Colégio foi **removida** em 26/11/2026: card, editor em Metas, API e `lib/longTerm.ts`; a tabela no banco ficou, sem uso) → linha com `.panel` do placar (`ScoreRing` + `StatRow`s, 5/12) e `.panel` do gráfico de evolução (7/12) → faixa “ritmo” **numa linha só em todas as BUs** (`.panel` + `Cell`s: meta do dia, da semana, ticket, conversão, leads; Colégio/Unicive ganham a célula de Faturamento/Matrículas e a métrica secundária vira sublinha `SubMeta` nas células de dia/semana). Slide Vendedores: BUs lado a lado (uma coluna por BU), linha compacta por vendedor.
- Gráfico (`UnifiedDailyChart`, Recharts `ComposedChart`; voltou ao visual original, com as cores e a legenda de antes): grade `#2d2c3a`, eixos `#87847a`, série principal na cor da BU (sem linha de leads e sem a tracejada “META” de 100%, removidas em 26/11/2026), % meta na cor semântica, ideal tracejado `#f0b44c`; a linha da % acumulada é só a linha (sem preenchimento nem brilho embaixo, removidos em 26/11/2026); tooltip próprio (`#14141b`, borda `#4a4230`, título dourado maiúsculo, diferença p.p. vs ritmo ideal).
- Números nunca podem estourar o card: use `truncate`, `clamp()` (como `StatCell`) ou reduza a fonte.
- Não há mais aviso de venda nova (toast + buzina): removido em 25/11/2026 — depois do cutover para o Conta Azul ele não disparava mais.
- **Meu Painel do vendedor** (`src/app/seller/page.tsx`) = uma página, sem duplicar; tem botão de **tela cheia** (`BotaoTelaCheia`, o mesmo do carrossel) ao lado de “Minha meta” e, no modo TV, a grade ocupa a altura toda (`.meu-painel-grade`): **sem cabeçalho** (26/11/2026): a foto (`AvatarUploader`) e o botão **Senha** (`ChangePasswordButton`, modal via portal) ficam na **barra do topo** (prop `extra` do `AppShell`/`Sidebar`, montada em `seller/layout.tsx`); o seletor de BU só aparece, ao lado de “Minha meta”, para quem vende em mais de uma → duas metades iguais (6/12 cada, mesma altura): à **esquerda** a **Minha meta** (indicadores em grade de 4 por linha — 5 quando passa de 8 —, o card de meta do mesmo tamanho dos outros; células vazias fecham a última linha) e embaixo a **Evolução diária** (`UnifiedDailyChart` `height="fill"`, ocupa o resto da altura); à **direita** a **Minha comissão** do topo até embaixo (`src/app/seller/MinhaComissao.tsx`, a antiga Gamificação: números lado a lado → jornada como **subida de montanha** (`src/app/seller/CommissionProgress.tsx`: SVG esticado com trilha em ziguezague, bandeira por faixa de comissão, topo = maior faixa (rótulo “· topo”; card “Jornada ate o topo”), avatar anda com o % da meta; a 1ª faixa fica no meio do 1º trecho da trilha e as demais igualmente espaçadas até o cume) com a tabela de faixas em `<details>` que abre **por cima** do card (absoluta — inline ela esticava a linha e a montanha não voltava ao tamanho) → pódio compacto). O card “Faturamento real/meta” da Gamificação saiu (repetia a meta). Faturamento vem de `stats.valorRealizado/valorMeta` (do vendedor). Login e Sair usam `window.location.assign` (não `router.push`) para limpar o Router Cache — senão a barra do topo da conta anterior reaparece.
- Perfis: admin vê todos os slides (GAV + BUs). O **Direto não é mais slide**: clicar na origem “Direto” do GAV abre um modal com o detalhe (`DirectDashboardView` dentro de `gav/DetalheOrigem`; o carrossel segura a rotação com o evento `carrossel:segurar` enquanto o modal está aberto). No GAV, cada linha mostra a % que representa da receita da BU e cada BU a % da receita da empresa; vendedor vê só os slides das próprias BUs + “Vendedores”.

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
- **Tabela → cartões**: coloque `className="table-stack …"` na `<table>` e `data-label="Rótulo"` em cada `<td>` (vazio `""` para a coluna de ações). No celular o `thead` some e cada `<tr>` vira um cartão "rótulo … valor". Aplicado em Vendedores, Comissões (resumo) e Leads. Tabelas largas de planilha (aba Ano) continuam com rolagem horizontal + 1ª coluna fixa.
- `ConfiguracoesSubnav` é uma linha única rolável (`no-scrollbar`) que centraliza a aba ativa; fica `sticky top-14` (abaixo da barra do topo).
- Tela cheia (TV) fica escondida no celular. Gráfico diário vai a 300px de altura (`max-sm:!h-[300px]`).
- Teste mobile: `next build && next start` + Playwright com `isMobile`/`hasTouch` e viewport 390×844; confira também `scrollWidth <= clientWidth` (sem rolagem horizontal da página).

## 6.3 Desempenho (leitura de dados e carregamento)

- **Camada de dados em lote** (`src/lib/data.ts`): as telas leem o mês em poucas consultas (`loadMonthSales`, `loadMonthLeads`, `loadMonthGoals`, `loadMonthDirect`, `loadSellers`) deduplicadas por requisição com `React.cache` (layout + página + funções compartilham o resultado) e agregam em memória. **Não faça consulta por vendedor/BU em laço** (antes: ~120 consultas no dashboard, ~85 em Comissões/Gamificação; agora 15 / 9).
- **Limite de 1000 linhas do Supabase**: consulta que pode passar disso usa `fetchAll(...)` (pagina com `.range()` + `.order("id")`). Consulta direta sem paginar corta em silêncio.
- Vendedor único: `sellerMonthRaw` (vendas de todas as BUs + leads + metas numa leva) alimenta `statsForSellerInBu` e `sellerSeries`.
- **`loading.tsx`** em `dashboard/`, `admin/` e `seller/` mostra o esqueleto (`PageSkeleton`) na hora e permite o prefetch das rotas; a barra do topo não some ao navegar.
- **Recharts em chunk separado**: use `UnifiedDailyChartLazy` / (`next/dynamic`, `ssr:false`) em vez de importar o gráfico direto. O carrossel do Dashboard TV monta **só o slide ativo**.
- Listas longas renderizam aos poucos.
- **Cache compartilhado e atualização**: o carrossel faz `router.refresh()` a cada **3 min** (só com a aba visível); `PainelDashboard` guarda os dados 5 min (`DASHBOARD_CACHE_SECONDS`), o GAV 10 min, e a comissão do Meu Painel usa `statsForAll` em `unstable_cache` compartilhado entre vendedores (`MinhaComissao.tsx`). Todos caem na hora a cada envio do Conta Azul (`DASHBOARD_TAG`, revalidado nas escritas). Não leia no GAV o que a tela não mostra.
- Índices: `supabase/perf-indexes.sql` (idempotente; também no fim do `schema.sql`) — rodar uma vez no SQL Editor.
- Medir: `next build && next start` com um PostgREST simulado com latência fixa e contagem de requisições; comparar saída antiga × nova da camada de dados antes de trocar consultas.

## 7. Pendências de identidade (não bloqueiam)

- `src/app/icon.svg`: favicon = cifrão dourado (gradiente `#f0dcb0→#c9ae7a→#af9256`) sobre fundo carvão.
- `avatar_color` padrão `#22c55e` em `src/app/api/sellers/route.ts` (e default da coluna no `schema.sql`).

## 8. Fluxo de trabalho neste repositório

- Branch de desenvolvimento: `claude/nifty-ramanujan-y9xwiu` (Vercel faz deploy do push). Outra sessão também empurra nela: faça `git fetch`/`git pull --rebase` antes de começar e antes de dar push.
- Verifique tipos com `npx tsc --noEmit` antes de commitar.
- Mudança de banco: manter `supabase/schema.sql` **idempotente** (`if not exists`, `drop … if exists`) e, para ajustes pontuais, criar um snippet SQL curto em `supabase/` — o usuário roda no SQL Editor do Supabase. Nunca presumir que a coluna nova já existe: as queries devem degradar sem derrubar a tela (vide `listSellers`).
- Segurança: `service_role` só no servidor; escritas passam por `/api/*`; login único por chave (admin = `ADMIN_PASSWORD`; **supervisor comercial = `SUPERVISOR_PASSWORD`**, opcional; vendedor = `sellers.password_hash`). `GET /api/sellers` nunca devolve `password_hash`.
- **Níveis de acesso** (`Role` em `lib/auth.ts`): `admin` (tudo) · `supervisor` (supervisor comercial, para as TVs do comercial: GAV, slides das BUs e Vendedores, **sem Configurações**; o middleware manda `/admin` e `/seller` para `/dashboard`; todas as escritas exigem admin/vendedor) · `seller` (Meu Painel + slides das próprias BUs).

## 9. Telas removidas (lançamento manual acabou)

- **Todas as Vendas** (`/admin/vendas`), **Direto / IA** (`/admin/direto`) e **Minhas Vendas** (`/seller/sales`) foram removidas: tudo vem do Conta Azul. Os endereços antigos só redirecionam. As rotas de API (`/api/sales`, `/api/direct/*`, `/api/admin/backup`) seguem no código, sem tela. ⚠️ Não há mais onde digitar as **visitas do site** (`direct_visits`), que alimentam a conversão do slide Direto/IA.

## 10. Vendedores vêm do Conta Azul

- **Configurações → Vendedores é UMA tabela só** (26/11/2026): todos os cadastros de vendedor do Conta Azul (`ca_vendedores`), cada um com um **destino** (Vendedor · Canal direto · Grupo · Pendente). Quem é *Vendedor* ganha BU, status e senha na própria linha. **Não se cria nem se exclui vendedor** (não há mais `POST /api/sellers` nem `DELETE /api/sellers/[id]`).
- `POST /api/ca/vendedores {ca_vendedor_ids, destino, bus?, seller_id?}`: virar *Vendedor* reaproveita o vendedor lembrado no cadastro (reativa), o indicado em `seller_id` (cadastro duplicado da mesma pessoa) ou um de mesmo nome; senão **cria** com as BUs (exige ao menos uma). Sair de *Vendedor* **não apaga**: fica inativo (se nenhum outro cadastro apontar para ele) e o `seller_id` fica no cadastro como memória — a normalização só o usa com destino `vendedor`.
- Cadastros ligados ao mesmo vendedor aparecem numa linha só. O **nome** é o do Conta Azul (`lib/ca/nomes.ts`); a normalização sincroniza o nome de quem já está ligado.
- Dashboard: sem a frase de rotação no rodapé; o slide Vendedores não mostra os donuts de origem Onvox/Indicação; o Meu Painel não tem o card de receita por categoria.

## 10.1 Matrículas do Colégio (Configurações → Colégio)

- O time digita **por série** (1º EF ao 3º EM), sempre o total até o momento: alunos hoje, rematrículas, desistências, novas. Tabela `colegio_matriculas` (SQL `supabase/colegio-matriculas.sql`; ano letivo fixo em `ANO_LETIVO` = 2027).
- **Não puxar do Conta Azul**: rematrícula e matrícula nova saem com o mesmo item (“MATRÍCULA - 9º Ano”), então a contagem automática misturaria as duas.
- Cálculo único e puro em `lib/colegioMatriculas.ts`: confirmados = rematrículas + novas; sem resposta = alunos hoje − rematrículas − desistências; **3º ano do Médio = concluintes** (não rematriculam nem entram em “sem resposta”; novas que entram nele contam). Rematrículas + desistências não podem passar dos alunos da série (tela e API recusam).
- No painel do Colégio: faixa `MatriculasColegio` no topo (4 números; **“Alunos confirmados” é o destaque** — célula mais larga, fundo azul e número bem maior, pois é o resultado do Colégio), não depende do mês, some enquanto nada foi preenchido. Em TV ≤800px o anel da meta encolhe para caber.

## 11. Classificação: salva sozinha e lê o espelho uma vez

- **Tudo salva ao mudar** (Categorias, Itens e Vendedores): não há botão de check; a linha mostra “Salvando… / Salvo ✓”. Vendedor com destino “Vendedor” só grava depois de escolher quem (senão a venda sumiria do ranking).
- **Desempenho**: `src/lib/ca/mapa.ts` lê `ca_vendas` e `ca_venda_itens` **uma vez**, em paralelo, e agrega tudo numa passada (`agregarEspelho`, `unstable_cache` 5 min, tag `ca-espelho`, invalidada por `gravarEspelho` a cada sync). A classificação é aplicada em memória por cima (antes eram 4 leituras de `ca_vendas` e 3 de itens, em série, a cada abertura e a cada salvar). Só entra no agregado o que **não** depende da classificação.
- **GAV — barras segmentadas e gráfico (26/11/2026)**: Por BU, as 3 origens (agora barras lado a lado embaixo da receita total, não mais tabela) e as Linhas de receita usam a **barra de progresso segmentada** (`gav/BarraSegmentada.tsx`): uma barra só, dourado (`DOURADO_REALIZADO`) = realizado e vermelho apagado (`COR_FALTA`) = falta; embaixo “Realizado R$ …” e “Falta R$ …” (ou “Acima +R$”, verde; ou “sem meta”). O “Acumulado × ritmo da meta” é o **mesmo `UnifiedDailyChart` da Evolução diária** (faturamento do dia, % da meta acumulada, % ideal por dias úteis, projeção); altura pela variável CSS `--gav-graf-h` (300px; 190px no modo TV). `GavGrafico` foi apagado. As duas barras (`DuasBarras`/`BarraBala`) ficaram só no detalhe do Direto.

## 12. Configurações — mudanças de 26/11/2026

- **Metas**: a meta de longo prazo (multi-mês) do Colégio saiu do sistema. O botão “Copiar mês anterior” saiu.
- **Leads**: o admin informa só o **total do mês até agora** de cada vendedor (`/api/leads/mes`, GET/PUT). Continua em `daily_leads`: o total vira uma linha no **dia 1 do mês** e as linhas diárias antigas do mês são apagadas (upsert primeiro, delete depois) — quem lê leads soma o mês e não mudou. A rota antiga `/api/leads` (dia a dia) segue no código, sem tela.
- **Vendedores**: ver §10 (tabela única). A Classificação ficou com Categorias e Itens.
- **Comissões**: a opção “comissão acumulativa entre faixas” saiu (o cálculo usa sempre a maior faixa atingida; a API grava `cumulative=false`). Nova opção **Comissão depois de impostos** (`after_tax` + `tax_pct` em `commission_rules`; SQL `supabase/commission-impostos.sql`), **desligada por padrão**: ligada, a % da faixa incide sobre o realizado × (1 − impostos%); a faixa continua decidida pelo % da meta (`calcCommission` → `baseComissao`). Sem as colunas no banco, a leitura cai no select antigo e o salvar avisa para rodar o SQL.
