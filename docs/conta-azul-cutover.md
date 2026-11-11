# Hub Comercial × Conta Azul — automatizar o faturamento, painel único do grupo e cutover de dezembro

**Para quem vai implementar.** Este documento diz o que existe hoje no Hub, o que a Conta Azul da
CPPEM **de fato contém** (medido, não suposto), onde as duas coisas se encaixam e onde não se
encaixam. As decisões que não são minhas aparecem numeradas, com recomendação e motivo.

**O que foi verificado e como.**

- O lado do Hub saiu da leitura deste repositório no commit `0bb69cd` (`supabase/schema.sql`,
  `src/lib/data.ts`, `src/lib/products.ts`, rotas de `src/app/api/`).
- O lado da Conta Azul saiu de uma integração que **já roda em produção** contra a API v2 **desta
  mesma empresa** (o Jarvis), onde os endpoints estão validados ao vivo.
- Os números de catálogo, mensalidade e vendedores de §3.4 foram **medidos no espelho real** do
  Conta Azul em 10/11/2026: 6.571 vendas e 7.041 itens, de 2025 e 2026.

O que não pude determinar está marcado **A CONFERIR** — nada aqui foi inventado.

---

## 1. O pedido

| # | Pedido | Natureza |
|---|---|---|
| 1 | O sistema continua funcionando como está, com os dados vindos do Conta Azul | integração + migração de origem do dado |
| 2 | Painel único do admin com **todo** o faturamento do grupo por linha de receita e **todas** as metas | tela nova sobre dados que hoje não existem juntos |
| 3 | Cutover: de dezembro em diante, só Conta Azul; sem lançamento manual | trava de escrita + regra de borda |

Com três regras dadas pelo requisitante, que mudam tudo:

- **Toda venda está no Conta Azul**, da matrícula à mensalidade, no Colégio e na Unicive.
- **Para o vendedor, só a matrícula conta** (Unicive e Colégio).
- O vendedor monta a venda no CA e ela tem de aparecer no Hub **ligada ao `seller_id` certo**,
  automaticamente.

A segunda regra é o problema de engenharia deste projeto, e §3.4 mostra por quê.

---

## 2. O sistema hoje

### 2.1 De onde vem o faturamento

| Tabela | O que é | Quem escreve | Tem vendedor? |
|---|---|---|---|
| `sales` | venda lançada pelo vendedor | `POST /api/sales` (sessão `role=seller`) | `seller_id` **NOT NULL**, FK → `sellers` |
| `direct_sales` | canal Direto / IA | `POST /api/direct/sales` | não (`channel` ∈ `direto`,`ia`) |
| `year_realizado` | realizado anual por BU/mês, só totais | `POST /api/year` | não |

`realizado_data`, `pace_data` e `metas_data` são herança do painel antigo e usam **outro
vocabulário de BU** — `cppem`,`colegio`,`unicv` — enquanto o resto do sistema usa
`cppem`,`unicive`,`colegio_cppem`. Código novo que toque nelas precisa traduzir.

### 2.2 A linha de receita, e o que falta nela

`product_line` é texto livre no banco, mas na prática é um dos **23 ids** de `src/lib/products.ts`:

- **CPPEM (8):** `mentorias`, `turmas_presenciais`, `cursos_online`, `presencial_em_casa`,
  `materiais_digitais`, `fisicos`, `eventos`, `supletivo`
- **Unicive (2):** `matriculas`, `bolsas_unicive`
- **Colégio (13):** `matricula_fund_1..9`, `matricula_em_1..3`, `fardamentos`

> **Não existe linha de mensalidade.** As 23 linhas foram desenhadas para medir **esforço de
> venda**, e mensalidade não é esforço de venda — é a consequência recorrente de uma matrícula já
> feita. Para o painel do grupo isso é um problema: §3.4 mostra que a mensalidade do Colégio é
> **R$ 546.869 em 2026**, quase dez vezes a matrícula. Faturamento do grupo sem mensalidade não é
> faturamento do grupo.

A BU é derivada da linha por `buFromProductLine()`, e o `else` final devolve `cppem`: uma linha
desconhecida **não dá erro, vira faturamento do CPPEM**. É a armadilha nº 1 (§11).

### 2.3 Como os totais são montados hoje

`src/lib/data.ts` é o único lugar que lê faturamento. Três coisas de lá mudam o desenho do painel:

1. **`buSeries` e `productBreakdown` somam `direct_sales` só para `cppem` e `unicive`** (`data.ts:523`
   e `data.ts:812`). Faturamento do Colégio nesse canal **não aparece em tela nenhuma**.
2. **`buSeries` devolve tudo zerado quando a BU não tem vendedor ativo** (`data.ts:490`), e nesse
   caminho nem soma o canal direto.
3. **`productBreakdown` filtra as vendas pelos `seller_id` dos vendedores ATIVOS da BU.** Desativar
   um vendedor apaga retroativamente o faturamento dele dos relatórios.

Nenhuma é bug do pedido atual, mas as três atingem direto o "total de TODO o grupo".

### 2.4 Metas — sete fontes, não uma

| Fonte | Granularidade | Campos de meta |
|---|---|---|
| `monthly_goals` | vendedor × BU × ano/mês | `valor_meta`, `quantidade_meta`, `ticket_medio_meta`, `taxa_conversao_meta`, `leads_meta` |
| `product_goals` | vendedor × linha × ano/mês | `valor_meta`, `quantidade_meta` |
| `bu_product_goals` | **BU × linha** × ano/mês | `valor_meta`, `quantidade_meta` |
| `bu_meta` | BU × ano/mês | `leads_meta`, `taxa_conversao_meta` |
| `long_term_goals` | BU, janela de vários meses | `base_count`, `target` (contagem, não R$) |
| `pace_data` | `product` × ano/mês (vocabulário antigo) | `meta`, `meta_leads`, `ticket_medio_meta`, `conversao_meta` |
| `metas_data` | `product` × ano (jsonb) | **A CONFERIR** no banco real |

**A meta da linha de receita que o painel pede é `bu_product_goals`.** A soma de `product_goals`
dos vendedores **não** é obrigada a fechar com ela, e nada no sistema força isso. Mostre as duas e a
diferença (§8.3) — a divergência é informação de gestão, não erro.

### 2.5 Perfis

Cookie HMAC (`src/lib/auth.ts`), `role` ∈ `admin`,`seller`. Não há RBAC granular: "painel do perfil
administrador" = rota sob `/admin` com `getSession()?.role === "admin"`.

**`/admin` está livre.** A aba "Visão Geral" foi removida e hoje `src/app/admin/page.tsx` só faz
`redirect("/admin/sellers")`. É o endereço natural do painel novo.

---

## 3. O que a Conta Azul entrega

Base `https://api-v2.contaazul.com/v1`. OAuth 2.0 via Cognito
(`https://auth.contaazul.com/oauth2/authorize` e `/token`), **scope fixo**
`openid profile aws.cognito.signin.user.admin` — não há escopo por recurso. Paginação por `pagina` +
`tamanho_pagina` (nunca `page`/`size`), tamanho 100.

> **Limite de 10 req/s** com `429 SpikeArrestViolation`, janela de 1 segundo — o retry tem de
> esperar **mais de 1s**. Sem throttle global na saída, a carga histórica morre no meio.

### 3.1 Os três endpoints que importam

| Endpoint | Entrega | Custo |
|---|---|---|
| `GET /venda/busca` | lista de vendas | 1 chamada por página de 100 |
| `GET /venda/{id}` | **vendedor**, `venda.id_categoria`, composição de valor, condição de pagamento | 1 por venda |
| `GET /venda/{id}/itens` | itens: `id_item`, `nome`, `descricao`, `tipo`, `quantidade`, `valor` | 1 por venda |

A lista devolve `id`, `numero`, `data`, `tipo`, `total`, `versao`, `criado_em`, `data_alteracao`,
`cliente.id`, `situacao.descricao` — e **nem vendedor, nem categoria, nem itens**. Linha de receita e
vendedor só existem no **detalhe**, uma venda por chamada.

`GET /venda/busca` **exige** `data_inicio` e `data_fim`. Para carga histórica, ano a ano; ano vazio
custa uma chamada e não dá erro.

### 3.2 Não existe webhook

A Conta Azul não notifica. É **polling**, e o campo que torna isso barato é `versao`: ele muda
quando a venda muda. Guarde `versao` e só busque o detalhe das vendas cuja `versao` divergiu — a
lista é barata, o detalhe é o que custa.

### 3.3 Categorias

`GET /categorias` e `GET /financeiro/categorias-dre` devolvem a árvore de categorias financeiras —
é por aí que se conhece o universo de `venda.id_categoria`.

### 3.4 O que o Conta Azul da CPPEM realmente contém

Medido em 10/11/2026 sobre 6.571 vendas e 7.041 itens (2025–2026).

**O catálogo é pequeno e fechado.**

| | |
|---|---|
| itens distintos (`item_ca_id`) | **301** |
| nomes distintos | 301 (relação 1:1 — nenhum id com dois nomes) |
| vendas com 2+ itens | **155** (2,4%) |
| vendas com vendedor preenchido | **6.571 de 6.571 — 100%** |
| situações encontradas | `Faturado`, `Aprovado`, `Cancelado` (1 caso) |

O catálogo é pequeno — e, como §4 mostra, nem precisa ser classificado item a item: a categoria
resolve. E **100% das vendas com vendedor** é o que torna o pedido "ligar ao `seller_id`" viável de
verdade: não há caso de venda anônima para tratar.

**A mensalidade é venda separada, mensal, e é grande.** Não é parcela da matrícula: são ~110 vendas
por mês, com item próprio.

| 2026 | itens | valor |
|---|---|---|
| `MENSALIDADE - <série> - COLÉGIO CPPEM` | 826 | R$ 478.640 |
| `EBOOK - MENSAL COLÉGIO <série>` | 116 | R$ 68.229 |
| **mensalidade, total** | **942** | **R$ 546.869** |
| `MATRÍCULA - <série> ENSINO ...` | 48 | R$ 25.562 |
| `EBOOK - MAT COLÉGIO <série>` | 61 | R$ 31.174 |
| **matrícula, total** | **109** | **R$ 56.736** |

> **A mensalidade do Colégio é 9,6× a matrícula.** Este número é o documento inteiro. Se a
> mensalidade entrar no painel do vendedor ou na meta da BU, ela afoga o esforço de venda na
> proporção de dez para um, e todo indicador de meta do Colégio perde sentido no dia do deploy.

Outras famílias de 2026: `EBK` 4.113 itens / R$ 1.142.389 (cursos CPPEM **e** Unicive — a Unicive
aparece dentro dela com 1.531 itens / R$ 155.358), `PLANO DE COMBATE` 519 / R$ 371.874,
`FARDAMENTO` 626 / R$ 63.529.

**O nome do item não é uma taxonomia — mas a CATEGORIA é.**

O nome do item engana: `MENSALIDADE - 6º Ano...` e `EBOOK - MENSAL COLÉGIO 6 FUND` são os dois
mensalidade; `MATRÍCULA - 9º ANO...` e `EBOOK - MAT COLÉGIO 9º ANO` são os dois matrícula. Qualquer
regra por texto (`nome LIKE '%mensal%'`) classifica errado.

A **categoria financeira da venda**, porém, é exatamente a taxonomia que falta — numerada, com
nome explícito, e já separando matrícula de mensalidade nas duas BUs:

| cód. | categoria | vendas 2026 | valor 2026 | conta p/ vendedor |
|---|---|---|---|---|
| 1.0 | TURMAS PRESENCIAIS E EVENTOS CPPEM | 1.408 | R$ 790.333 | ✅ |
| 1.1 | MENTORIAS E PLATAFORMAS CPPEM | 546 | R$ 376.450 | ✅ |
| 1.2 | CURSOS ONLINE CPPEM | 223 | R$ 88.519 | ✅ |
| 1.3 | MATERIAIS DIGITAIS CPPEM | 291 | R$ 32.364 | ✅ |
| 1.4 | MATERIAIS FÍSICOS CPPEM | 319 | R$ 39.689 | ✅ |
| **1.5** | **MATRÍCULA UNICIVE** | **1.360** | **R$ 123.647** | ✅ **é o que conta na Unicive** |
| 1.6 | REPASSE MENSALIDADE UNICIVE | — | — | ❌ |
| 1.7 | MATRÍCULA COLÉGIO | 80 | R$ 43.384 | ✅ |
| 1.8 | MENSALIDADE COLÉGIO | 903 | R$ 540.874 | ❌ |
| 1.9 | FARDAMENTOS COLÉGIO | 121 | R$ 50.984 | ❌ (decidido em 10/11) |
| 2.0 | LIVROS EDITORIAIS COLÉGIO | — | — | ❌ (decidido em 10/11) |
| 2.1 | SUPLETIVO CPPEM | 19 | R$ 14.654 | ✅ |
| 2.1 | EVENTOS DO COLÉGIO | 70 | R$ 2.742 | ❌ (decidido em 10/11) |
| 2.3 | FRETES RECEBIDOS · 2.4 MULTAS DE CANCELAMENTO | 3 | R$ 709 | ❌ (ignorar) |

**O furo: 300 vendas sem categoria, e crescendo.**

| | vendas | valor |
|---|---|---|
| sem categoria (`categoria_ca_id is null`) | **300** | **R$ 46.167** |
| categoria preenchida mas fora do cadastro | 4 | R$ 1.209 |

Não é dívida antiga: **out/26 teve 78 e nov/26 já tem 94 em dez dias.** E o que são essas vendas
importa muito — são, em maioria, **matrícula da Unicive**:

```
  145  R$ 27.985  EBK - TECNO UNICIVE
   18  R$  5.506  EBK - TEC PARA TECNO UNICIVE
    7  R$  6.466  EBK - ATÉ A FARDA
   62  R$    614  EBK - INTENSIVAO PMPE
   28  R$  1.200  EVENT - Dia das crianças
```

E caem justamente em cima de quem vende Unicive: Victor Willyans (67 vendas), Pablo Choi (62),
Itallo (45). Com a regra "a categoria decide", essas vendas viram **pendência** e somem do número
do vendedor — exatamente o contrário do que o requisitante pediu.

Daí a consequência de projeto: o **fallback pelo item não é opcional**, é o que sustenta ~R$ 46 mil
e crescendo. É por isso que `ca_mapa_receita` aceita os dois tipos (§5.2).

#### O que acontece de verdade com essas vendas (conferido no espelho em 10/11, 19h50)

O requisitante relatou o fluxo real: **a venda entra automática como "site/venda" e depois o
vendedor é trocado à mão** para Pablo ou Victor. Fui conferir se essas trocas chegam ao espelho.
Chegam — e o que o dado mostra muda a leitura do problema:

| conferência | resultado |
|---|---|
| último sync do espelho | 10/11 às 18:32 (≈1h antes da consulta) |
| vendas de novembro com detalhe **defasado** (`versao ≠ detalhe_versao`) | **0 de 196** |
| vendas de novembro sem detalhe nenhum | **0** |
| vendedor já reatribuído no espelho | **sim** — aparecem como Pablo Choi / Victor Willyans |

As vendas reatribuídas estão em `v3`, `v4`, `v6`, `v8` — foram editadas três, quatro, seis vezes — e
o espelho leu **a versão mais recente de cada uma**. Isto é prova de campo de que o incremental por
`versao` de §3.2 funciona: a troca de vendedor é uma alteração como qualquer outra e entra no
próximo ciclo.

E o padrão de versão conta a história toda:

| versão da venda | com categoria | sem categoria |
|---|---|---|
| v1 (criada e pouco mexida) | 49 | 15 |
| v2 | 35 | 4 |
| **v3** | 7 | **36** |
| **v4** | 7 | **25** |
| v6 | 1 | 10 |

Venda pouco editada = lançada à mão, com categoria. Venda muito editada = veio do site e foi
reatribuída — **e continua sem categoria depois da reatribuição**. Ou seja: quem troca o vendedor
não está preenchendo a categoria, e não há por que esperar que passe a preencher.

**A conclusão que importa:** o que falta não é o vendedor, é a linha. E o caso é mais simples do
que parecia — **as 70 vendas sem categoria de Pablo e Victor em novembro são todas o MESMO item**:

```
  70 vendas   R$ 9.070   EBK - TECNO UNICIVE
```

Esse item aparece em **1.304 outras vendas com categoria 1.5 Matrícula Unicive** (98,9%). Portanto:

> **Uma linha no mapa de item — `EBK - TECNO UNICIVE` → 1.5 Matrícula Unicive, conta para
> vendedor — recupera 100% do mês de novembro do Pablo e do Victor.**

Isso reposiciona §3.5: o mapa de item não é remendo para desleixo, é o **mecanismo principal** de um
fluxo permanente — venda de site, que nasce sem categoria por construção e é reatribuída depois.

**E é do mês corrente, não dívida velha.** Medido por mês, nos dois vendedores mais atingidos:

| mês | Victor Willyans | Pablo Choi |
|---|---|---|
| set/26 | 12% do mês sem categoria | 0% |
| out/26 | 74% | 67% |
| **nov/26** | **97%** | **100%** |

O Hub é mensal e diário — a meta é do mês. Então isto **não é problema histórico, é o problema de
agora**: **sem o mapa de item**, Pablo Choi fecharia novembro com R$ 0 e Victor com R$ 140 de
R$ 4.318. Com o mapa, os dois ficam inteiros. A curva de outubro para cá não é deterioração de
processo: é a venda de site (Unicive) virando a maior parte do que esses dois vendem.

Há também uma **ação fora do software**: 94 vendas sem categoria em dez dias é problema de
lançamento no Conta Azul. Corrigir isso na origem é mais barato que qualquer regra no Hub, e reduz
a fila de pendências a quase nada.

### 3.5 Como o sistema descobre a BU de uma venda sem categoria

A pergunta certa (requisitante, 10/11): *"TEC PRA TECNO" é Unicive, "ATÉ A FARDA" e "INTENSIVÃO
PMPE" são CPPEM, "Dia das crianças" é evento do Colégio e não vai para vendedor nenhum — como o
sistema identifica isso?*

**Não identifica pelo nome, e não deve tentar.** Nenhum dos quatro nomes diz a BU: "ATÉ A FARDA"
não tem "CPPEM" escrito, "Dia das crianças" não tem "Colégio". Qualquer heurística de texto aqui
erra.

Mas o dado resolve, por um caminho melhor: **o mesmo item já está categorizado corretamente em
outras vendas.** O furo inteiro são **11 itens distintos**, e 10 deles têm maioria clara:

| item | vendas sem categoria | como o MESMO item aparece em outras vendas |
|---|---|---|
| `EBK - TECNO UNICIVE` | 145 | **1.5 Matrícula Unicive × 1.304** (99%) |
| `EBK - INTENSIVAO PMPE` | 62 | **1.3 Materiais Digitais CPPEM × 30** (100%) |
| `EBK - TEC PARA TECNO UNICIVE` | 18 | **1.5 Matrícula Unicive × 232** (97%) |
| `EBK - OPERAÇÃO ALVORADA VIP` | 18 | **1.0 Turmas e Eventos CPPEM × 20** (95%) |
| `EBK - OPERAÇÃO ALVORADA COMUM` | 18 | **1.0 Turmas e Eventos CPPEM × 22** (85%) |
| `EBK - ATÉ A FARDA` | 7 | **1.1 Mentorias CPPEM × 4** (100%) |
| `EVENT - Dia das crianças` | 28 | 2.1 Eventos do Colégio × **1** ← amostra fraca |
| `EBK - TURMA PMPE` | 1 | **1.0 × 274** |
| `EBK - BACH UNICIVE` · `EBK - SEG GRAD UNICIVE` | 1 cada | 1.5 × 2 cada |
| `EBK - TAF` | 1 | **nenhuma** ← único órfão de verdade (R$ 10) |

Os quatro exemplos do requisitante batem com o dado: TEC PARA TECNO → 1.5 (Unicive), ATÉ A FARDA →
1.1 (CPPEM), INTENSIVÃO PMPE → 1.3 (CPPEM), Dia das crianças → 2.1 (Eventos do Colégio) — e este
último com `conta_vendedor = false`, porque evento do Colégio não é venda de ninguém.

**Como usar isso, e como NÃO usar.**

Use para **pré-preencher a tela de classificação** (§5.3), uma vez: o sync olha o histórico de cada
item sem mapeamento e sugere a categoria dominante, com o número de ocorrências ao lado. O humano
confirma em um clique. Depois disso o item está no mapa e toda venda futura resolve direto, sem
inferência nenhuma.

**Não** use como regra permanente de runtime. Uma "votação por maioria" rodando para sempre muda de
resposta sozinha no dia em que alguém lançar um lote errado — e muda em silêncio. A inferência serve
para encher o mapa depressa; quem decide continua sendo a tabela.

Dois cuidados que o dado já mostra:

- **Exija piso de amostra.** `EVENT - Dia das crianças` tem 28 vendas sem categoria e **uma** única
  com. Sugira, não aplique. Um piso razoável: maioria ≥ 90% **e** pelo menos 5 ocorrências.
- **Aceite que sobra órfão.** `EBK - TAF` não tem nenhuma venda categorizada. Vai para pendência e
  alguém decide. É R$ 10 — e é assim que tem de ser: o sistema não inventa.

### 3.6 Devolver o erro para quem pode corrigir

O requisitante observou que essas vendas são **erro de lançamento do vendedor**, não falha do
sistema. Isso abre a melhor saída: em vez de o Hub compensar para sempre, ele **mostra o erro de
volta**.

Na tela de pendências (§5.3) e no painel, liste as vendas sem categoria **com o nome de quem
lançou** — hoje seriam Victor Willyans (67), Pablo Choi (62) e Itallo (45). Quem lançou corrige no
Conta Azul, o sync seguinte pega a categoria certa e a venda entra sozinha no lugar certo.

É o mesmo princípio da barra de "venda sem dono" (§8.6): o Hub não conserta o dado, ele aponta para
quem consegue consertar.

> **A Unicive está resolvida por aqui.** `1.5 MATRÍCULA UNICIVE` são 1.360 vendas e R$ 123.647 em
> 2026 — é o que o vendedor fez. A mensalidade da Unicive é `1.6 REPASSE MENSALIDADE UNICIVE` e
> **nem aparece como venda** no período: ela entra como repasse no contas a receber, sem venda e
> sem cliente. Ou seja, na Unicive a regra "só matrícula conta" sai de graça: o que chega como
> venda **já é** só matrícula.

Dois detalhes que mordem:

- **`codigo` não é único, e as duas metades têm regras OPOSTAS.** `2.1` é SUPLETIVO CPPEM
  (**conta** para o vendedor) **e** EVENTOS DO COLÉGIO (**não conta**). Chavear pelo código não é
  imprecisão: é creditar ou deixar de creditar comissão errado. Use `ca_categoria_id`.
- **300 vendas de 2026 (R$ 46.167) não têm categoria nenhuma** — e é o furo que §4 precisa cobrir.
  Ver abaixo.

**Os vendedores do CA são 26, e três coisas quebram o casamento ingênuo:**

```
  1.078  R$ 557.125  Erika Magalhães | 6c187680
    877  R$ 265.828  Giovana Mirela  | c96ad3ed
    762  R$ 224.378  Timóteo         | 3da43304
    352  R$ 204.625  Liliane limeira | 6ec9cd6a   ←┐ mesma pessoa,
    338  R$ 194.709  Lilliane Limeira| 47555f99   ←┘ DOIS registros
    744  R$ 197.153  DIRETORIA       | 3b9a8b5b   ← não é vendedor
     13    R$ 7.011  Site - Vendas Avulsas        ← não é vendedor
      1       R$ 30  Contador                     ← não é vendedor
```

1. **Renomear no CA não quebra nada — o requisitante está certo.** O `vendedor_ca_id` é estável:
   `399bf11f` aparece no histórico como "SITE / DIRETO" **e** como "Itallo", e é a mesma linha de
   ligação o tempo todo. O nome gravado em cada venda é só o do momento do lançamento; ele serve
   para a tela de mapeamento, nunca para casar. **Ligue `vendedor_ca_id` ↔ `seller_id` e ignore o
   nome.**
2. **O problema real é o inverso: uma pessoa com dois `vendedor_ca_id`.** "Liliane limeira"
   (`6ec9cd6a`, abr→jul/2026, R$ 204.625) e "Lilliane Limeira" (`47555f99`, jul→out/2026,
   R$ 194.709) **não se sobrepõem no tempo**: o cadastro foi refeito em julho, não duplicado. Para
   venda nova, só o id atual importa; para o **histórico**, os dois precisam apontar para a mesma
   pessoa — por isso a ligação é uma tabela N:1 (§6.3), e não uma coluna em `sellers`.
3. **Parte dos "vendedores" não é vendedor.** `DIRETORIA` responde por R$ 197.153 e é quem aparece
   em boa parte das mensalidades. Precisa de um estado explícito "não conta para vendedor" — e não
   de um `seller` inventado.

E o detalhe que fecha o raciocínio: **as mensalidades estão creditadas a Liliane / DIRETORIA**, que
são justamente quem faz o lançamento administrativo. Mandá-las para `sales` com `seller_id` sem
separar faria essas duas pessoas aparecerem com ~R$ 60–80 mil/mês de "venda".

---

## 4. Decisão 1 — de onde sai a linha de receita

| Opção | Como | A favor | Contra |
|---|---|---|---|
| **A — categoria da venda** ✅ | `venda.id_categoria` → mapa → linha | **já separa matrícula de mensalidade nas duas BUs** (§3.4); fila de classificação de **~18 categorias**, não 301 itens; 1 chamada de detalhe por venda | uma categoria por venda: as 155 vendas mistas (2,4%) entram inteiras numa linha só. Não diz a série do Colégio |
| **B — itens da venda** | `/venda/{id}/itens` → `item_ca_id` → mapa | reparte venda mista; dá `quantidade` por linha; dá a série do Colégio | 2 chamadas por venda; 301 itens para classificar, com três famílias de nome para o mesmo conceito |
| **C — rateio do recebível** | rateio por categoria do evento de contas a receber | é a verdade contábil do caixa | é por parcela; sem quantidade; sem vendedor |

**Recomendação: A como chave principal, B só onde a série importa.**

A primeira versão deste documento recomendava B, porque o nome do item parecia a única coisa que
distinguia matrícula de mensalidade. A tela de contas a receber do requisitante mostrou que não é:
a **categoria** faz essa distinção de forma explícita e numerada (`1.5 - MATRÍCULA UNICIVE`,
`1.8 - MENSALIDADE COLÉGIO`). Classificar 18 categorias é uma tarefa de dez minutos que acerta;
classificar 301 itens é uma tarde que erra.

O item continua necessário em **um** caso: as 13 linhas do Colégio são por série
(`matricula_fund_1..9`, `matricula_em_1..3`) e `1.7 MATRÍCULA COLÉGIO` não diz a série — só o nome
do item diz. Como são **80 vendas no ano**, buscar itens só para a categoria 1.7 (e 1.8, se a
mensalidade for quebrada por série) custa quase nada.

Regra prática:

```
categoria preenchida e mapeada → BU, linha e conta_vendedor saem dela
    └─ é MATRÍCULA/MENSALIDADE COLÉGIO → busca os itens só para achar a série
categoria AUSENTE ou não mapeada → cai para o mapa de ITEM (300 vendas/R$ 46 mil hoje)
    └─ item também não mapeado → fila de pendências (§5). Nunca um palpite.
```

---

## 5. O mapa de receita

### 5.1 Por que ele é inevitável

A Conta Azul não conhece as linhas do Hub, e nenhuma regra textual é confiável (§3.4). A
integração equivalente que já roda em produção no Jarvis resolve isto do mesmo jeito: uma tabela
preenchida por gente, uma vez, consultada depois.

Com a decisão de §4, o trabalho inicial é **18 categorias**, não 301 itens — e cresce só quando a
contabilidade cria uma categoria nova, o que acontece uma ou duas vezes por ano.

### 5.2 Desenho

```sql
-- Categoria financeira da Conta Azul → linha de receita do Hub.
-- `ca_tipo` existe porque o Colégio precisa descer ao item para achar a série
-- (§4); para todo o resto, só a categoria é usada.
create table if not exists public.ca_mapa_receita (
  ca_tipo        text not null check (ca_tipo in ('categoria','item')),
  ca_id          text not null,            -- ca_categoria_id, NUNCA o código "1.5"
  ca_nome        text,                     -- "1.5 - MATRÍCULA UNICIVE", só para a tela
  bu             text    check (bu in ('cppem','unicive','colegio_cppem')),
  linha          text,                     -- linha de receita (ver §5.4); null = não classificado
  -- A REGRA DO REQUISITANTE, numa coluna: só a matrícula conta para o vendedor.
  -- Mensalidade, repasse e afins entram no faturamento do GRUPO e ficam fora da
  -- meta, do ranking e da comissão.
  conta_vendedor boolean not null default false,
  -- Esta categoria precisa dos ITENS para achar a série (1.7/1.8 do Colégio).
  quebra_por_item boolean not null default false,
  ignorar        boolean not null default false,  -- não é faturamento (frete, multa, estorno)
  classificado_em  timestamptz,
  classificado_por text,
  primary key (ca_tipo, ca_id)
);
```

> **`ca_id` é o `ca_categoria_id`, não o código.** O código `2.1` pertence a duas categorias
> diferentes (SUPLETIVO CPPEM e EVENTOS DO COLÉGIO) — chavear por ele junta receita de duas BUs.

`conta_vendedor` tem **default `false`** de propósito: item novo não creditado a ninguém é um erro
que se percebe (o vendedor reclama); item novo creditado por engano é um erro que vira comissão
paga. O default protege o lado caro.

Três estados, os três visíveis:

- **classificado** → `linha` preenchida, entra no faturamento.
- **ignorado** → `ignorar = true`, fora de propósito, e registrado.
- **pendente** → `linha is null and not ignorar`. **Não entra no faturamento e tem de aparecer na
  tela como um número**, não como silêncio. Pendência é dinheiro invisível.

O sync **descobre e insere** as pendências sozinho; nunca adivinha a classificação.

### 5.3 A tela de classificação

Sub-aba em Configurações (`ConfiguracoesSubnav` — a navegação está duplicada em **três** layouts,
ver `CLAUDE.md` §4). Pendentes primeiro, com nome do CA, quanto já movimentaram, e seletores de BU,
linha e `conta_vendedor`. Sem esta tela, cada item novo precisa de SQL na mão e a integração para de
ser mantida em duas semanas.

### 5.4 Vendedor novo: o que acontece sozinho

Pergunta do requisitante (11/11). O caminho é este, e o ponto central é que
**nada se perde e nada vai para a pessoa errada**:

```
  cadastra vendedor novo no Conta Azul
        ↓
  primeira venda dele entra no espelho
        ↓
  o sync descobre o ca_vendedor_id novo → destino = 'pendente'   ← o default
        ↓
  a receita vai para ca_receita marcada "conta p/ vendedor, sem dono"
        ↓
  aparece como VENDA SEM DONO na barra de meta + aviso no painel do GAV
        ↓
  admin liga o cadastro ao vendedor do Hub em GAV › Classificação
        ↓
  Reprocessar → as vendas caem em `sales`, no vendedor certo
```

**`pendente` é o único default seguro.** Com `vendedor`, um cadastro novo
herdaria vendas por acidente — e comissão junto. Com `grupo`, a receita sumiria
do ranking sem ninguém notar. Pendente é o único estado que obriga alguém a
decidir, e o aviso é o que impede que a decisão fique para depois.

O aviso de pendências fica no **painel** do GAV, não só na aba de Classificação:
sem isso, um vendedor novo dependeria de alguém lembrar de abrir a outra tela, e
a venda dele ficaria sem dono em silêncio — exatamente o caso que a barra de
alerta existe para pegar.

### 5.5 O pré-preenchimento

Classificar à mão o que o sistema consegue deduzir é desperdício — mas deduzir
sozinho em produção é pior. O meio-termo: a tela chega preenchida com o selo
**"sugerido: …"**, e um clique confirma. `src/lib/ca/sugestao.ts`.

**Categoria → BU, linha e regra**, por palavra no nome:

| nome contém | sugere |
|---|---|
| `MATRÍCULA UNICIVE` | unicive · `matriculas` · conta |
| `MATRÍCULA COLÉGIO` | colegio_cppem · **sem linha** · conta |
| `MENSALIDADE` · `REPASSE` | a BU do nome · sem linha · **não conta** |
| `FARDAMENTO` | colegio_cppem · `fardamentos` · **não conta** |
| `LIVRO` · `EVENTO DO COLÉGIO` | colegio_cppem · sem linha · **não conta** |
| `MENTORIA` · `CURSO ONLINE` · `TURMA PRESENCIAL` · `MATERIAIS` · `SUPLETIVO` | cppem · a linha correspondente · conta |
| `FRETE` · `MULTA` · `RENDIMENTO` · `EMPRÉSTIMO` | **ignorar** |

`MATRÍCULA COLÉGIO` fica sem linha de propósito: são 12 séries e só o nome do
item diz qual.

> **Por que ler texto é seguro aqui, e não no catálogo de itens.** As categorias
> são uma lista curta mantida pela contabilidade, com vocabulário próprio e
> estável. Os itens são nomes livres de produto, onde `MENSALIDADE - 6º Ano` e
> `EBOOK - MENSAL COLÉGIO 6 FUND` são a mesma coisa — por isso lá o palpite vem
> do histórico do item (§3.5), não do texto.

**Vendedor do CA → vendedor do Hub**, por nome normalizado: sem acento, sem
caixa e **sem letra repetida**, o que faz `Lilliane` e `Liliane` casarem — os
dois cadastros da mesma pessoa. `SITE / DIRETO` vira `canal_direto`; `DIRETORIA`
e `Contador` viram `grupo`.

Casar por nome é o único caminho possível (o `ca_vendedor_id` é um UUID do Conta
Azul e o `seller_id` é um UUID do Hub, sem nada em comum até alguém ligar os
dois uma vez) **e por isso tem de ser sugestão**: um "Victor" novo no Conta Azul
não pode herdar as vendas do Victor que já existe só porque o nome bate.

### 5.6 As linhas de receita precisam crescer

As 23 linhas atuais não têm mensalidade (§2.2). Para o painel do grupo, proponho **acrescentar** —
sem mexer nas 23, que continuam governando meta e ranking:

| Linha nova | BU | Categoria de origem | Por quê |
|---|---|---|---|
| `mensalidade_colegio` | colegio_cppem | 1.8 | R$ 540.874 em 2026; a maior linha do Colégio |
| `repasse_unicive` | unicive | 1.6 | não chega como venda (vem pelo contas a receber) — a linha existe para o painel do grupo fechar |
| `livros_colegio` | colegio_cppem | 2.0 | sem linha no Hub hoje |
| `eventos_colegio` | colegio_cppem | 2.1 | hoje cairia em `eventos` do CPPEM pelo `else` de `buFromProductLine()` |

Quebrar a mensalidade por série (como a matrícula já é) só se o requisitante pedir: são 12 linhas
novas e a leitura do painel piora. Comece com uma linha por BU e o detalhe por série sob demanda.

---

## 6. Decisão 2 — onde o dado do Conta Azul é gravado

Aqui está o "temos que ver a melhor forma para que não quebre". Existem **duas noções de receita** e
elas não podem morar no mesmo lugar sem defesa:

| | o que soma | para que serve |
|---|---|---|
| **Receita do grupo** | tudo: matrícula, mensalidade, curso, fardamento, produto | o painel do §8 |
| **Receita do vendedor** | só o que `conta_vendedor` | meta, ranking, comissão, dash da BU |

| Opção | Como | A favor | Contra |
|---|---|---|---|
| **A — tudo em `sales` + flag** | coluna `conta_vendedor` em `sales`; todo caminho de vendedor filtra por ela | uma tabela só; painel do grupo trivial | são **6 caminhos de leitura** em `data.ts` (`statsForAll`, `statsForSellerInBu`, `sellerSeries`, `buSeries`, `productBreakdown`, comissão). **Um `where` esquecido = vendedor com R$ 60 mil/mês a mais** e comissão paga em cima disso |
| **B — mensalidade fora de `sales`** ✅ | `sales` recebe só o que conta para o vendedor; o resto vai para `ca_receita` | **nenhuma query existente muda** — é impossível inflar ranking por esquecimento; `sales` continua significando exatamente o que significa hoje | o painel do grupo lê três fontes em vez de duas |

**Recomendação: B.** O pedido foi literalmente "ver a melhor forma para que não quebre", e a
diferença entre as duas opções é onde mora o risco: na A, a corretude depende de alguém lembrar de
um `where` em seis lugares, hoje e em toda alteração futura; na B, o dado que não pode contar para o
vendedor simplesmente **não está na tabela que o ranking lê**. A primeira falha em silêncio e a
falha custa dinheiro (comissão). A segunda, no pior caso, mostra um total incompleto no painel novo
— visível na hora.

Isto **não contraria** o requisitante: a matrícula, que é o que conta para o vendedor, vai para
`sales` com `seller_id`, exatamente como ele pediu. O vendedor monta a venda no CA e ela aparece no
painel dele. O que fica fora de `sales` é só o que ele próprio disse que **não** conta.

### 6.1 `sales` — o que muda

As mesmas colunas de rastreio entram em `direct_sales`, que passa a receber o canal direto do CA
(Itallo e Site - Vendas Avulsas) — é a tabela que o painel de vendas diretas vai ler.

```sql
alter table public.sales
  add column if not exists origem      text not null default 'manual'
    check (origem in ('manual','conta_azul')),
  add column if not exists ca_venda_id text,
  add column if not exists ca_item_id  text,
  add column if not exists ca_versao   integer;

-- Idempotência NO BANCO: um item de uma venda do CA = no máximo uma linha aqui.
-- Sem isto, cada rodada do sync duplica faturamento — e o duplicado parcial é
-- pior que a falha, porque o total continua plausível.
create unique index if not exists sales_ca_item_uniq
  on public.sales (ca_venda_id, ca_item_id) where origem = 'conta_azul';

-- Canal direto do CA: mesma estrutura, na tabela que já existe para venda sem vendedor.
alter table public.direct_sales
  add column if not exists origem      text not null default 'manual'
    check (origem in ('manual','conta_azul')),
  add column if not exists ca_venda_id text,
  add column if not exists ca_item_id  text,
  add column if not exists ca_versao   integer;

create unique index if not exists direct_sales_ca_item_uniq
  on public.direct_sales (ca_venda_id, ca_item_id) where origem = 'conta_azul';
```

> `direct_sales.channel` hoje só aceita `direto` e `ia`. O canal do CA cabe em `direto`; com
> `origem` para distinguir, não precisa de valor novo no CHECK. Se o requisitante quiser separar
> "site" de "direto" no painel futuro, aí sim vale um valor a mais.

`seller_id` **continua `NOT NULL`**: em `sales` só entra o que conta para um vendedor, e isso
pressupõe vendedor. Venda cujo `vendedor_ca_id` não está mapeado **não** entra aqui — vai para
`ca_receita` e para a fila de pendências. Fail-safe: vendedor não mapeado nunca credita ninguém.

### 6.2 `ca_receita` — a receita do grupo que não é do vendedor

```sql
create table if not exists public.ca_receita (
  ca_venda_id  text not null,
  ca_item_id   text not null,
  data         date not null,
  bu           text,
  linha        text,                 -- linha de receita (§5.4); null = pendente
  valor        numeric(14,2) not null default 0,
  quantidade   numeric(14,4) not null default 1,
  -- true = a categoria CONTA para vendedor, mas a venda chegou sem vendedor
  -- mapeado. É a "venda sem dono" da §8.6: receita do grupo que ainda pode
  -- virar receita de alguém, e que a barra de meta mostra em cor de alerta.
  conta_vendedor boolean not null default false,
  cliente_ca_id    text,
  -- Guardado para AUDITORIA, não para crédito: é quem lançou no CA.
  vendedor_ca_id   text,
  seller_id    uuid references public.sellers(id) on delete set null,
  ca_versao    integer,
  primary key (ca_venda_id, ca_item_id)
);
create index if not exists ca_receita_data_idx  on public.ca_receita (data);
create index if not exists ca_receita_linha_idx on public.ca_receita (bu, linha, data);
```

`seller_id` aqui é nullable e serve só para relatório ("quem lançou"), nunca para meta ou comissão.

### 6.3 Vendedor do CA → vendedor do Hub (N:1)

```sql
-- N:1 de propósito, e NÃO por causa de renomeação: renomear no CA mantém o id
-- (399bf11f aparece como "SITE / DIRETO" e como "Itallo", mesma ligação).
-- O caso que exige N:1 é o oposto: o cadastro da Liliane foi REFEITO em julho
-- (6ec9cd6a abr→jul, 47555f99 jul→out), e o histórico só fecha se os dois ids
-- apontarem para a mesma pessoa.
create table if not exists public.ca_vendedores (
  ca_vendedor_id text primary key,
  ca_nome        text,                  -- último nome visto; só para a tela
  -- Para onde a receita deste cadastro vai. Ver o de-para abaixo.
  destino        text not null default 'pendente'
    check (destino in ('vendedor','canal_direto','grupo','pendente')),
  seller_id      uuid references public.sellers(id) on delete set null,
  visto_em       timestamptz not null default now()
);
```

`destino` em vez de um booleano porque são **três** destinos, não dois (§6.4), e `pendente` é o
default: cadastro novo no CA não credita ninguém até alguém dizer o que ele é.

#### O de-para, fechado em 10/11/2026

O Hub tem **6 vendedores**. Os outros 20 cadastros do CA são canal direto, administrativo ou gente
que saiu.

| destino | cadastros do CA | o que acontece com a receita |
|---|---|---|
| **`vendedor`** (6) | Erika Magalhães `6c187680` · Giovana Mirela `c96ad3ed` · Timóteo `3da43304` · Julya Cabral `f542a409` · Victor Willyans `29bdb04c` · Pablo Choi `cb2f9533` | vai para `sales` com `seller_id`; conta em meta, ranking e comissão |
| **`canal_direto`** (2) | SITE / DIRETO · Itallo `399bf11f` · Site - Vendas Avulsas `9a457903` | vai para `direct_sales`; é o painel de vendas diretas que o requisitante quer depois |
| **`grupo`** (4) | DIRETORIA `3b9a8b5b` · Liliane `6ec9cd6a` **e** `47555f99` · Contador `74245ff0` | vai para `ca_receita`; faturamento do grupo, de ninguém |
| **`grupo`** (14, histórico) | Talyta Rebeca · Leticia Maria · Felipe Silva Social Selling · Hugo Leonardo · Nanny Silva · Monique Rockselle · Kauan Murilo · Silas Leonardo · Elias · Everton Mota · Gyovana · Stephanie · Evyla Fernanda · Maria Eduarda | saíram ou nunca foram vendedores do Hub; a receita entra no grupo e o histórico fecha |

> **Itallo não é vendedor, é canal.** O requisitante foi explícito: `399bf11f` é venda direta por
> site. Cadastrá-lo como `seller` poluiria o ranking com um "vendedor" que é na verdade uma origem.

#### A regra final, fechada em 10/11/2026

| conta para o vendedor | não conta |
|---|---|
| 1.0 Turmas e Eventos CPPEM · 1.1 Mentorias · 1.2 Cursos online · 1.3 Materiais digitais · 1.4 Materiais físicos · **1.5 Matrícula Unicive** · **1.7 Matrícula Colégio** · 2.1 **Supletivo CPPEM** | 1.6 Repasse mensalidade Unicive · 1.8 Mensalidade Colégio · 1.9 Fardamentos · 2.0 Livros · 2.1 **Eventos do Colégio** · 2.3 Fretes · 2.4 Multas |

**O que cada vendedor perde com ela, em 2026:**

| vendedor | conta | deixa de contar | sem categoria | o que saiu |
|---|---|---|---|---|
| Erika Magalhães | R$ 551.218 | R$ 1.224 | R$ 5.222 | mensalidade |
| **Giovana Mirela** | R$ 225.204 | **R$ 45.229** | — | **fardamentos R$ 44.346** |
| Timóteo | R$ 221.513 | R$ 1.630 | R$ 512 | fardamentos, multas |
| Julya Cabral | R$ 87.472 | R$ 0 | R$ 500 | — |
| **Victor Willyans** | R$ 26.925 | R$ 0 | **R$ 13.560** | — |
| **Pablo Choi** | R$ 20.891 | R$ 100 | **R$ 12.184** | — |

Três coisas saltam, e as três têm consequência:

1. **Só a Giovana é afetada de verdade**: ela perde R$ 45 mil, 17% do número dela, quase tudo
   fardamento. Se a meta dela foi construída com fardamento dentro, a meta precisa ser refeita junto
   com a regra — senão ela abre dezembro devendo 17% sem ter vendido menos.
2. **Victor e Pablo dependem do mapa de item para existir.** 33% e 37% do número deles está em
   venda sem categoria. Sem §3.5, os dois perdem um terço do faturamento no dia do cutover.
3. **A matrícula do Colégio é pequena e tem dono difuso**: R$ 43.384 no ano inteiro, dos quais
   Giovana fez R$ 31.512 (73%) e **R$ 9.838 (23%) foram lançados por DIRETORIA e Liliane** — que
   não são vendedores. Essa é a "venda sem dono" do Colégio, e é quase um quarto da BU.

#### Quanto fica fora dos seis — medido

Só nas categorias que **contam para vendedor** (fora mensalidade, repasse e fardamento):

| | ano 2026 | últimos 3 meses | novembro |
|---|---|---|---|
| os 6 do Hub | 72,8% | **87,4%** | 77,6% |
| os 6, mas **sem categoria** | 2,1% | 6,1% | **18,2%** |
| administrativo (DIRETORIA, Liliane, Contador) | 3,6% | 4,5% | 0,0% |
| canal direto | 0,8% | 1,6% | 4,1% |
| ex-vendedores | 20,7% | 0,5% | 0,0% |

Duas leituras importam:

1. **No período que o sistema vai viver, quase tudo já é dos seis.** Em novembro, 95,8% da receita
   que conta para vendedor pertence a eles (77,6% classificada + 18,2% sem categoria). Os 20,7% de
   ex-vendedores são do começo do ano e não voltam.
2. **O problema de hoje não é "venda sem dono", é "venda sem linha".** Em novembro, a venda sem
   vendedor mapeado é 4,1% (o canal direto); a venda de vendedor conhecido **sem categoria** é
   18,2%. São problemas diferentes — §8.6 separa os dois na tela.

E o furo se fecha: as vendas sem categoria usam **11 itens distintos** (§3.5), todos resolvidos pelo
mapa de item. Classificados esses 11, os 18,2% de novembro passam a cair no vendedor certo e na
linha certa, sem tocar no Conta Azul.

### 6.4 O fluxo completo

```
  /venda/busca (ano a ano no histórico; janela de 90 dias no incremental)
        │
        ├─ espelho ca_vendas: id, data, total, versao, cliente, situação
        │
        ├─ versao mudou ou venda nova?   ── não → fim (custo zero)
        │                                   sim ↓
        ├─ /venda/{id}        → vendedor_ca_id, id_categoria
        ├─ /venda/{id}/itens  → itens
        │
        └─ classifica (categoria; sem categoria → item; nenhum dos dois → pendência)
                │
                └─ classificado ↓
                      conta_vendedor?
                        ├─ não  → `ca_receita`   (mensalidade, repasse, fardamento)
                        └─ sim ↓
                              ca_vendedores[vendedor].destino
                                ├─ vendedor     → `sales`        (seller_id obrigatório)
                                ├─ canal_direto → `direct_sales` (painel de vendas diretas)
                                ├─ grupo        → `ca_receita`
                                └─ pendente     → `ca_receita` + fila de "venda sem dono" (§8.6)
```

**Venda cancelada precisa de caminho de remoção.** A situação muda, mas a linha já está gravada.
Reprocessar o que mudou não desfaz o que foi gravado: o sync tem de **apagar** as linhas (nas duas
tabelas) de uma venda que saiu da lista de situações que contam. Na amostra de §3.4 só apareceram
`Faturado` e `Aprovado` — confirme a lista completa (§12) e trate todo o resto como remoção.

---

## 7. Sincronização

| Item | Decisão |
|---|---|
| Gatilho | cron a cada 15 min no horário comercial + botão "sincronizar agora" no painel |
| Janela do incremental | últimos 90 dias (venda antiga ainda muda: baixa, cancelamento) |
| Carga histórica | ano a ano, uma vez, em processo separado do cron |
| Estado | `ca_sync` com `recurso`, `concluido_em`, `erro`, contadores |
| Erro | 429 → espera > 1s e retenta (até 4×); erro de uma venda não aborta o lote |

Grave quantas vendas foram lidas, quantas tiveram detalhe buscado, quantas foram para `sales`,
quantas para `ca_receita` e quantas caíram em pendência. **Um sync que "deu certo" lendo zero vendas
é o modo de falha mais comum e mais silencioso dessas integrações** — o contador é o que o denuncia.

Custo real, com os números de §3.4: ~110 mensalidades + o resto do mês dá algumas centenas de vendas
novas; a 10 req/s e 2 chamadas de detalhe por venda, o incremental de 90 dias que mudou cabe em
poucos minutos.

---

## 8. As telas: painel do grupo, painel do vendedor e a venda sem dono

**Endereço `/admin`** (hoje só redireciona). Gate: `getSession()?.role === "admin"`.

### 8.1 O que ele responde, de cima para baixo

1. **Faturamento do grupo no período** — número grande: `sales` + `direct_sales` + `ca_receita`.
   Com meta do grupo (soma de `bu_product_goals`), % e ritmo (`src/lib/calc.ts` já tem pace/projeção).
2. **Uma faixa por BU** — realizado, meta, %. Cor de identidade da BU (`BU_COLOR`) no chip; cor
   **semântica** (`COLOR`) no número — `CLAUDE.md` §2: identidade nunca colore resultado.
3. **A tabela que é o pedido** — toda linha de receita das três BUs, agrupada por BU, com
   `realizado valor` · `meta valor` · `%` · `realizado qtd` · `meta qtd`, subtotal por BU e total do
   grupo. Com as linhas novas de §5.4, são ~26 linhas.
4. **A separação que o requisitante pediu, explícita:** em cada BU, quanto é **matrícula (conta para
   vendedor)** e quanto é **recorrente/outros (só grupo)**. É o que impede alguém de comparar o
   painel do grupo com o painel do vendedor e achar que um dos dois está errado.
5. **Receita fora das linhas** — pendentes de classificação, vendedor não mapeado, canal Direto/IA.
   Três números que explicam qualquer diferença entre o total e a soma das linhas.

E um painel **separado, depois**: as **vendas diretas** (`direct_sales`, onde cai o canal do CA —
Itallo e Site - Vendas Avulsas). O requisitante quer essa tela, mas ela não é pré-requisito do
cutover: o dado já estará gravado desde a fase 3, então a tela pode vir quando for conveniente. Em
novembro isso é 4,1% da receita que conta para vendedor.
6. **As outras metas** — §8.3.

### 8.2 De onde cada número sai

| Número | Fonte |
|---|---|
| Realizado por linha | `sales` + `direct_sales` + `ca_receita`, agrupado por `linha` |
| Meta por linha | `bu_product_goals` |
| Total da BU | soma das linhas da BU — **não** `buSeries` (ver §2.3) |
| Total do grupo | soma das três BUs + receita fora das linhas |

> **Não reutilize `productBreakdown()` neste painel.** Ela filtra pelos `seller_id` dos vendedores
> **ativos** e ignora `direct_sales` no Colégio. As duas coisas são aceitáveis na tela de vendedores
> e inaceitáveis num painel cujo único propósito é fechar o total do grupo. Escreva
> `grupoBreakdown()`, que parte da linha de receita e não passa por vendedor.

Faça-a com **uma leitura por tabela** no período (não uma por BU), agregando em memória: `sales`,
`direct_sales`, `ca_receita`, `bu_product_goals` e as metas de §8.3. Cinco idas ao banco para a tela
inteira. Use `fetchAll()` de `src/lib/data.ts` em toda leitura — ver armadilha nº 2 (§11).

### 8.3 "Todas as metas mesmo"

| Bloco | Fonte | Observação |
|---|---|---|
| Meta de faturamento da BU | soma de `bu_product_goals` | denominador do % principal |
| Soma das metas individuais | `monthly_goals` | **mostre a diferença** contra a linha acima |
| Metas por vendedor × linha | `product_goals` | detalhe sob demanda, não na primeira dobra |
| Leads e conversão | `bu_meta`; realizado de leads em `daily_leads` | |
| Meta longa | `long_term_goals` ativas na janela | é **contagem**, não R$ — não some com faturamento |
| Meta anual | `metas_data` / `pace_data` | vocabulário antigo de BU (§2.1); **A CONFERIR** se ainda é alimentada |

**A mensalidade provavelmente não tem meta** em nenhuma dessas tabelas — ela nunca foi meta de
vendedor. No painel, linha de receita sem meta mostra `—`, nunca `0%`: zero por cento diz "não
bateu", traço diz "não há meta". São coisas diferentes e a diferença importa.

### 8.4 Desenho

Siga `CLAUDE.md`: `.panel` nas faixas, `.card` nos blocos, `.eyebrow-label` nos títulos,
`.kpi-num`/`.big-num` (Oxanium) nos números, `COLOR` de `src/lib/brand.ts` como **única** paleta para
valor numérico, `BU_COLOR` só como identidade. Números em coluna pedem tabular; número não pode
estourar o card (`truncate`/`clamp()`).

26 linhas numa tabela só, em tela de TV, não se lê: agrupe por BU com subtotal, grupo colapsável,
CPPEM aberto por padrão.

### 8.5 O painel do vendedor — deixar claro o que conta

`src/app/seller/page.tsx` já mostra `stats.valorRealizado / stats.valorMeta`. Com a arquitetura de
§6 esse número fica **certo por construção**: `sales` só contém o que conta para o vendedor, então
nada precisa ser filtrado na tela.

O que precisa mudar é o **rótulo**. O vendedor da Unicive vai abrir o Conta Azul, ver o total da
empresa e comparar com o Hub. Se a tela não disser o que está contando, ele conclui que o Hub está
errado. Escreva na tela, ao lado do valor:

> **Matrículas · R$ 12.480** — mensalidade e repasse não entram na sua meta

Com um "ⓘ" explicando em uma frase: *a meta do vendedor é sobre matrícula; mensalidade é
consequência de matrícula já feita e entra só no faturamento do grupo.* Isso evita a conversa
"meu número está errado" todo mês.

O mesmo rótulo vale no cartão da BU no Dashboard TV.

### 8.6 A barra de meta com três estados — a venda sem dono

O requisitante pediu: quando a venda chega sem vendedor anexado, a barra de meta tem de mostrar
isso em cor de alerta, para o vendedor saber que **há venda para pegar** no Conta Azul.

**De onde sai o número.** É `ca_receita` onde `conta_vendedor = true` e o `ca_vendedores.destino`
é `pendente`: a linha diz que aquilo conta para alguém, mas o cadastro do CA não está mapeado. Ou
seja, receita que **ainda pode virar** de um vendedor.

**Dois problemas diferentes, e misturá-los estraga o aviso.** Medido em novembro de 2026, dentro
das categorias que contam para vendedor:

| | novembro | o que é | quem resolve |
|---|---|---|---|
| **sem dono** | 4,1% (R$ 3.097) | classificada, mas o cadastro do CA não é de nenhum vendedor | admin mapeia em `ca_vendedores`, ou o vendedor assume a venda no CA |
| **sem linha** | 18,2% (R$ 13.658) | é de um dos seis vendedores, mas a venda saiu **sem categoria** | o mapa de item (§3.5) resolve os 11 casos; depois disso, quem lança corrige no CA |

A barra mostra **sem dono**. A **sem linha** é um contador à parte na tela de pendências, porque a
ação é outra — e porque ela tende a zero assim que os 11 itens de §3.5 forem classificados. Pintar
as duas da mesma cor faria o vendedor tentar "pegar" uma venda que já é dele.

**Os três segmentos**, na ordem, com a paleta de `src/lib/brand.ts`:

| Segmento | Cor | O que é |
|---|---|---|
| atribuído | `COLOR.ok` `#5fd08f` | realizado com vendedor — o que já é de alguém |
| **sem dono** | `COLOR.warning` `#f0b44c` | conta para vendedor, mas ninguém pegou |
| falta | trilho `white/10` | o que falta para a meta |

```
  ├────────────── meta ──────────────┤
  ████████████████▒▒▒▒▒░░░░░░░░░░░░░░░
  └─ atribuído ──┘└ sem ┘└── falta ──┘
                   dono
```

**Cor não pode carregar o recado sozinha.** Medido: verde × âmbar dá ΔE 17,7 em visão normal (passa
o piso de 15), 10,3 em deuteranopia, mas **7,2 em protanopia** — abaixo do piso de 8. Então o
segmento vem sempre com:

- um **rótulo com número** embaixo da barra: `R$ 3.240 sem vendedor · 7 vendas`, em `COLOR.warning`;
- e esse rótulo é **clicável**, levando à lista das vendas sem dono (venda, cliente, data, valor),
  que é onde a ação acontece.

Sem o rótulo o segmento é só uma faixa de cor estranha no meio da barra; com ele, é uma tarefa.

Dois detalhes de implementação, os dois já conhecidos neste repositório:

- `ProgressBar` hoje é trilho + um preenchimento. Vai precisar aceitar **segmentos**. Mantenha
  `rounded-full` e deixe **2px de respiro entre os dois preenchimentos** — encostados, verde e
  âmbar viram um degradê e o olho não acha a fronteira.
- Quando `sem dono = 0`, **não desenhe o segmento nem o rótulo**. Uma barra que mostra "0 sem
  vendedor" todo dia treina a equipe a ignorar o aviso justamente até o dia em que ele aparece.

**A meta geral da Unicive** (`bu_product_goals` da linha `matriculas`) é o denominador natural
desta barra: o requisitante confirma que a Unicive tem meta de faturamento no nível da BU, e a
venda sem dono é exatamente o que separa "a BU bateu" de "um vendedor bateu".

---

## 9. O cutover de dezembro

O requisitante confirmou que **toda venda está no CA, nas três BUs** — então o cutover vale para
todas, e a dúvida que havia sobre o Colégio está resolvida.

### 9.1 O que exatamente trava

Lançamento manual acontece em **dois** lugares de escrita. Travar um e esquecer o outro é o erro
óbvio:

| Rota | Quem usa | Ação |
|---|---|---|
| `POST /api/sales` | vendedor (`src/app/seller/sales/NewSaleModal.tsx`) | **bloquear** |
| `POST /api/direct/sales` | admin (`src/app/admin/direto/NewDiretoSaleModal.tsx`) | **bloquear** (decisão 3) |
| `PATCH`/`DELETE` de ambas | correção | decisão 3 |
| `POST /api/year` | realizado anual digitado | **bloquear** para ano ≥ cutover |

A trava é **no servidor**. Esconder o botão é cosmético: a rota continua aberta a quem souber o
endereço e a sessão do vendedor é um cookie válido. Esconda o botão **também** — mas depois.

### 9.2 Como

```ts
// src/lib/cutover.ts
/**
 * A partir desta data, faturamento só entra pelo Conta Azul.
 * Data, não booleano: a trava vale pela DATA DA VENDA, não pela data de hoje —
 * senão uma venda de novembro lançada em dezembro seria recusada e corrigir o
 * passado ficaria impossível.
 */
export const CUTOVER_MANUAL = "2026-12-01";

export function manualBloqueado(saleDate: string): boolean {
  return saleDate >= CUTOVER_MANUAL;
}
```

Em cada rota de escrita, antes do insert:

```ts
if (manualBloqueado(sale_date)) {
  return NextResponse.json(
    { error: "A partir de dezembro o faturamento vem do Conta Azul. Lance a venda lá." },
    { status: 409 },
  );
}
```

A mensagem diz **o que fazer**, não só que falhou — quem bater nisso não leu nenhum aviso.

### 9.3 Decisão 3 — o que fica de fora da trava

1. **PATCH/DELETE continua?** Recomendo **sim para `origem='manual'`, não para
   `origem='conta_azul'`**: editar à mão um dado que o sync reescreve na próxima rodada gera uma
   divergência que ninguém entende. Com `origem` na tabela, é uma condição de uma linha.
2. **Venda de novembro lançada em dezembro?** A regra acima permite (a trava é pela data da venda).
   Se a intenção é fechar novembro de vez, precisa de um segundo prazo ("novembro aceita lançamento
   até 05/12") — decisão de gestão.
3. **O canal Direto/IA entra?** Ele existe porque é venda **sem vendedor**, que é exatamente o que o
   CA passa a trazer. Recomendo **bloquear junto**: manter aberto deixa a porta por onde o
   faturamento volta a divergir, e ninguém vai lembrar dela em março.

### 9.4 GAV — o dashboard de ensaio, e por que ele não é uma tela nova

Pedido do requisitante (10/11): um botão **GAV** na navbar, só para admin, que abre **o mesmo
dashboard** porém **100% alimentado pelo Conta Azul**, como se o cutover já tivesse acontecido.

É a ideia certa, e a forma de implementá-la é o que a torna confiável.

#### A chave: GAV é a mesma tela lendo a outra origem

Com a coluna `origem` de §6.1, a diferença entre as duas visões é **um filtro**:

| | lê |
|---|---|
| Dashboard normal | `sales where origem = 'manual'` |
| **GAV** | `sales where origem = 'conta_azul'` |

Nada mais muda: mesmos componentes, mesmas agregações, mesmas metas (meta não tem origem). É
justamente isso que dá valor à comparação — **se o GAV tivesse código próprio, bater não provaria
nada** sobre o que vai acontecer no cutover. Provaria só que dois programas diferentes chegaram ao
mesmo número uma vez.

E no dia do cutover não se "liga o GAV": vira-se o padrão de `origem`, e a tela normal passa a
mostrar o que o GAV já mostrava.

#### Como ligar isso no código que existe

1. **Um parâmetro `fonte` nos leitores de `src/lib/data.ts`.**

   ```ts
   type Fonte = "manual" | "conta_azul";

   // Uma constante só governa o padrão — o cutover é trocar esta linha.
   export const FONTE_PADRAO: Fonte = "manual";
   ```

   Os quatro loaders (`loadMonthSales`, `loadMonthLeads`, `loadMonthGoals`, `loadMonthDirect`)
   passam a receber `fonte` e filtrar `.eq("origem", fonte)` onde faz sentido (vendas e direto;
   leads e metas não têm origem).

2. **⚠️ A armadilha do cache, que vai morder se passar batido.** Os loaders são embrulhados em
   `memo` (= `React.cache`), com chave formada pelos **argumentos**. Se `fonte` não entrar na
   assinatura, a página normal e o GAV na mesma requisição **servem um o cache do outro** — e o
   GAV mostra os números manuais com cara de Conta Azul, que é o pior resultado possível para uma
   tela cuja função é conferir.

   E `fonte` tem de ser **argumento posicional primitivo**, não dentro de um objeto: `React.cache`
   compara por identidade, então `{fonte}` cria um objeto novo a cada chamada e o cache nunca
   acerta — some o ganho que fez esses loaders existirem (de ~120 consultas por abertura para uma
   leitura por conjunto).

   ```ts
   const loadMonthSales = memo(async (year: number, month: number, fonte: Fonte) => { … });
   ```

3. **A rota.** `/admin/gav`, com `getSession()?.role === "admin"`. O corpo de
   `src/app/dashboard/page.tsx` vira um componente que recebe `fonte`; as duas rotas o usam. Sem
   fork de tela.

4. **A navbar.** O Hub não tem sidebar — `Sidebar.tsx` renderiza a barra do topo. Entra um
   `SidebarItem` `{ href: "/admin/gav", label: "GAV" }` **apenas no ramo `isAdmin`**. Lembre que os
   itens estão duplicados em **três** layouts (`admin`, `dashboard`, `seller`) — `CLAUDE.md` §4.

#### O que o GAV precisa mostrar além do dashboard

Um dashboard idêntico em outra aba não responde "está certo?" — obriga a comparar de olho. Ponha
uma faixa no topo do GAV, e é ela que faz a tela valer:

```
  manual R$ 74.945   ·   Conta Azul R$ 61.287   ·   diferença −R$ 13.658 (−18,2%)
```

E, abaixo, a mesma diferença **por vendedor e por linha de receita** — é onde a divergência vira
ação. Com os dados de novembro de 2026 a tela já nasceria apontando o problema real:

| vendedor | manual (nov) | Conta Azul | diferença |
|---|---|---|---|
| Pablo Choi | R$ 4.893 | **R$ 0** | **−100%** |
| Victor Willyans | R$ 4.318 | R$ 140 | **−97%** |

Não porque a integração esteja errada: porque **97% e 100% das vendas deles em novembro saíram do
Conta Azul sem categoria** (§3.4). O GAV não inventa esse problema — ele o torna impossível de
ignorar antes que vire o número oficial de alguém.

#### O critério para virar a chave

Rode em paralelo por **duas semanas**, comparando **só o que conta para o vendedor** — é o único
universo que as duas origens têm em comum. Mensalidade aparece só de um lado, e isso é esperado,
não divergência.

Vire a chave quando, por **vendedor** (não só no total), a diferença estiver dentro de poucos por
cento. O total pode fechar por compensação — um vendedor a mais, outro a menos — e esconder
exatamente o erro que mais dói, que é o número individual.

**Não apague o histórico manual.** Ele é a única prova do que foi faturado antes do cutover, e
`origem` já o distingue sem precisar movê-lo. Depois do cutover, o GAV pode ser invertido (mostrar
o manual histórico) ou simplesmente removido — decida na hora, para não virar entulho.

---

## 10. Migrations, em ordem

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `supabase/ca-01-mapa.sql` | `ca_mapa_receita` |
| 2 | `supabase/ca-02-espelho.sql` | `ca_vendas`, `ca_venda_itens`, `ca_sync` |
| 3 | `supabase/ca-03-vendedores.sql` | `ca_vendedores` (N:1) |
| 4 | `supabase/ca-04-sales.sql` | `origem`, `ca_venda_id`, `ca_item_id`, `ca_versao`, índice único |
| 5 | `supabase/ca-05-receita.sql` | `ca_receita` |
| 6 | `supabase/ca-06-token.sql` | token OAuth do CA (`access_token`, `refresh_token`, `expires_at`) |

Todas idempotentes (`if not exists`, `add column if not exists`), no estilo do `supabase/schema.sql`.
RLS ligada e sem policy nas novas (o app lê por `service_role`, como o resto).

**O token do Conta Azul não vai em variável de ambiente**: ele expira e é renovado por
`refresh_token`, precisa de escrita. No `.env` (e no `.env.local.example`) vão só
`CONTA_AZUL_CLIENT_ID`, `CONTA_AZUL_CLIENT_SECRET` e `CONTA_AZUL_REDIRECT_URI`.

---

## 11. Armadilhas já pagas por outro projeto

1. **`buFromProductLine()` manda desconhecido para `cppem`.** Linha nova ou errada não dá erro: vira
   faturamento do CPPEM. Valide contra a lista de linhas e **recuse** o resto.
2. **PostgREST devolve no máximo 1000 linhas, em silêncio.** Sem laço de paginação, o 1001º registro
   não existe para o código — e o total continua plausível. `fetchAll()` em `src/lib/data.ts` já
   trata; **use-a** em toda leitura nova.
3. **Idempotência tem de ser no banco**, não no código — a chave única de §6.1/§6.2 é o que impede o
   sync de duplicar faturamento quando roda duas vezes ou morre no meio.
4. **O vendedor só existe no detalhe da venda.** Plano que tente ranking a partir da lista está
   errado desde o começo.
5. **Casar vendedor por nome não funciona** — e neste banco falha nas duas direções: dois ids para a
   mesma pessoa e dois nomes para o mesmo id (§3.4).
6. **Limite de 10 req/s, janela de 1 segundo.** Retry sem esperar mais de 1s só gasta tentativa.
7. **Venda cancelada precisa de caminho de remoção.**
8. **Dois vocabulários de BU convivem no banco** (§2.1). Traduza explicitamente.
9. **Fuso.** `POST /api/sales` já usa `todayISORecife()` porque o default UTC jogava venda da noite
   para o dia seguinte. A data do CA (`data`, `AAAA-MM-DD`) não tem fuso — use como está, não
   converta.
10. **Acento.** `MATRÍCULA` com acento não casa com um filtro escrito `MATRICULA`. Em qualquer
    comparação de texto no catálogo, normalize os dois lados — ou melhor, não compare texto (§5.1).

---

## 12. A conferir no ambiente real

Respondido pelo requisitante em 10/11/2026:

- ✅ Toda venda está no CA (matrícula e mensalidade), nas três BUs → o cutover vale para todas.
- ✅ Para o vendedor, só a matrícula conta (Unicive e Colégio).
- ✅ Os dados vão para `sales` com `seller_id` — com a ressalva de §6: **só o que conta para o
  vendedor**.

Medido no espelho (§3.4): catálogo de 301 itens · 100% das vendas com vendedor · 155 vendas mistas ·
situações `Faturado` e `Aprovado` · 26 vendedores no CA.

Continua aberto:

1. ✅ **Unicive resolvida pela categoria**: `1.5 MATRÍCULA UNICIVE` (1.360 vendas, R$ 123.647 em
   2026) conta para o vendedor; `1.6 REPASSE MENSALIDADE UNICIVE` não — e nem chega como venda.
2. ✅ **Regra de `conta_vendedor` fechada** em 10/11: fora ficam 1.6, 1.8, **1.9 fardamentos**,
   **2.0 livros** e **2.1 eventos do Colégio** (além de fretes e multas). Tabela completa em §6.3.
3. ✅ **As 300 vendas sem categoria** (R$ 46.167, 94 só em nov/26) foram resolvidas pelo mapa de
   item em 11/11: o histórico classificou as famílias do CPPEM e da Unicive, e o nome do item
   resolveu o Colégio (§12.1). Sobrou **1 item**, um ingresso de R$ 8,83. Fica a pergunta
   operacional: alguém vai corrigir no Conta Azul também? Não é mais necessário para o Hub, mas
   limparia a origem — e o relatório do próprio Conta Azul.
4. **Lista completa de situações de venda** que contam como faturamento. O espelho trouxe
   `Faturado`, `Aprovado` e **um** `Cancelado` — o caminho de remoção de §6.4 não é hipotético.
5. ✅ **De-para dos vendedores fechado** em 10/11 (§6.3): 6 vendedores, 2 canal direto, 18 grupo.
6. **`metas_data`** — formato do jsonb e se ainda é alimentada.
7. **A mensalidade tem meta?** Se tiver, onde ela é cadastrada (§8.3).

---

## 12.1 O que o GAV mediu em 11/11/2026 — e o que ainda é decisão de alguém

A primeira conferência real rodou na janela **01/09 a 11/11/2026** (1.546 vendas no espelho). Três
coisas estavam erradas no código e foram corrigidas; duas continuam esperando decisão humana.

### Corrigido: o corte silencioso de 1.000 linhas

`.limit(20000)` **não** levanta o teto do PostgREST — ele devolve 1.000 e não avisa. A normalização
lia 1.000 de 1.546 vendas e **perdia 35% do faturamento**, produzindo um número plausível. Toda
leitura do módulo passa agora por `src/lib/ca/ler.ts`, que pagina com `order` explícito (sem
ordenação, a página 2 não continua de onde a 1 parou — o Postgres não promete ordem estável entre
consultas).

É a armadilha mais caras deste projeto porque o sintoma é um número *quase* certo.

### Corrigido: o Colégio não tinha como ser classificado

| O problema | Por quê | A correção |
|---|---|---|
| A série não sai da categoria | São 12 séries e 2 categorias (`1.7`, `1.8`) — nenhuma votação por categoria dominante descobre se é 6º ou 9º ano | `palpitarItem()` lê a série do **nome do item** (`MATRÍCULA - 9º Ano Ensino Fundamental`), que aqui é taxonomia de verdade |
| Os itens do Colégio nunca entravam na fila | `itensRelevantes()` só olhava venda **sem categoria**; venda com categoria classificada **sem linha** — o caso do Colégio — ficava de fora | a relevância passou a ser "a categoria não resolve a linha", o que cobre os dois casos |
| A mensalidade não tinha onde cair | O Colégio é medido em **quantidade** de matrículas: 54 mensalidades do 6º ano em `matricula_fund_6` viram 54 alunos novos. E criar a linha em `products.ts` a faria aparecer no formulário do vendedor | linhas só-do-grupo em `src/lib/ca/linhas.ts`: válidas para `ca_receita`, invisíveis para `sales` e para o vendedor |

**Achado que confirma a precedência item→categoria de §4:** `1.7 - MATRÍCULA COLÉGIO` contém 7 itens
`MENSALIDADE` (R$ 4.154) e `1.8 - MENSALIDADE COLÉGIO` contém 2 itens `MATRÍCULA` (R$ 874). Quem
lança erra a categoria de vez em quando; o nome do item acerta as 9.

### Corrigido: `ca_receita` era escrita e nunca lida

Desde o início a receita do grupo ia para `ca_receita` e **nenhuma tela a mostrava**. O GAV exibia
R$ 80 mil de novembro e escondia R$ 60 mil de mensalidade do Colégio. O painel
`GavReceitaGrupo` agora separa dois blocos que nunca devem ser somados:

- **receita do grupo** (desenho): mensalidade R$ 61.560 em out/26 · eventos R$ 960 · fardamento
  R$ 466 · reforço R$ 295;
- **sem dono** (defeito): a linha conta para vendedor e chegou sem vendedor que o Hub reconheça.

### Resultado

| | antes | depois |
|---|---|---|
| vendas consideradas | 999 | 1.544 |
| viraram venda de vendedor | 714 | 1.104 |
| linhas de receita do grupo | 209 | 451 |
| **pendente** | **R$ 134.511** | **R$ 147** (1 item: ingresso de R$ 8,83) |

Novembro, que é o mês em que o pipeline rodou do começo: manual R$ 78.733 × Conta Azul R$ 80.856
(**+2,7%**), com as matrículas do Colégio fechando **ao centavo** (`matricula_fund_3`, `_7`, `_8`,
`_9` com delta R$ 0,00) e `turmas_presenciais` com −R$ 23.

### Aberto 8 — a DIRETORIA lança R$ 13.808 que contam para vendedor

`DIRETORIA` está mapeada como `grupo` (correto: não é vendedora), mas 177 linhas lançadas por ela
**contam** para vendedor — em maioria matrícula do Colégio. Hoje elas aparecem em "sem dono", o que
é honesto e inútil: ninguém recebe.

As opções não são equivalentes:

1. **Creditar por regra de linha** — matrícula do Colégio lançada pela DIRETORIA vai para a Giovana
   (que é a do Colégio). Resolve o valor; cria uma regra que precisa ser revista quando a pessoa do
   Colégio mudar.
2. **Corrigir na origem** — quem lança passa a pôr o vendedor certo no Conta Azul. Mais lento, e é a
   única que também arruma o relatório do próprio Conta Azul.
3. **Aceitar como receita do grupo** — a matrícula do Colégio não conta para ninguém. Muda a regra
   fechada em 10/11 ("para o vendedor, só a matrícula conta").

Isto move comissão, então é decisão do requisitante, não do código.

### Aberto 9 — "Elias"

Vendedor do Conta Azul que não está na lista dos 6 do Hub e tem R$ 566 de linhas que contam para
vendedor. Precisa de um destino: vendedor novo, canal direto ou grupo.

---

## 13. Ordem de execução

| Fase | Entrega | Pronto quando |
|---|---|---|
| 0 | ✅ concluída — regra, de-para e situações decididos | — |
| 1 | OAuth + espelho + `ca_sync` | uma rodada lê vendas e grava o espelho, com contadores |
| 2 | `ca_mapa_receita` + `ca_vendedores` + telas de classificação | fila de pendências em zero |
| 3 | Normalização → `sales` e `ca_receita` (migrations 4 e 5) | `Σ conta_azul` ≈ `Σ manual` no universo do vendedor |
| 4 | Painel `/admin` | total do grupo fecha com a soma das linhas + os três números de §8.1.5 |
| 5 | **GAV** (§9.4) + comparação em paralelo | duas semanas sem divergência relevante **por vendedor** |
| 6 | Cutover | `origem='manual'` com data ≥ cutover: zero linhas |

As fases 1 a 3 são a integração; a 4 é independente e pode andar em paralelo (sobre o dado manual,
trocando a fonte depois); a 6 só depois da 5. **Não comece pela 6** — travar o manual antes de o
automático fechar deixa o grupo sem número de faturamento.
