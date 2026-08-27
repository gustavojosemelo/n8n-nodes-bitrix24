# App Shopify — Precificação Regional

App **custom** (não público) que resolve a precificação por região de entrega numa loja
Shopify no plano **Growth**, onde Shopify Functions não está disponível.

A solução é **variante por região**: cada produto ganha uma option `Região`, com uma
variante por região cadastrada e seu próprio preço. Como a assinatura do Loop Commerce
fica vinculada a um `variantId`, o preço correto é cobrado em **toda renovação**, sem
depender de um desconto ser reaplicado a cada ciclo.

> **O banco é a fonte de verdade da configuração; o Shopify é o destino do sync.**
> Havendo divergência, o app reconcilia banco → Shopify, nunca o contrário.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Rodando localmente](#rodando-localmente)
- [Configuração no Shopify Partners](#configuração-no-shopify-partners)
- [Deploy no Coolify](#deploy-no-coolify)
- [Operação do dia a dia](#operação-do-dia-a-dia)
- [API](#api)
- [Decisões de implementação](#decisões-de-implementação)
- [Documentos complementares](#documentos-complementares)

---

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 22 + TypeScript |
| Framework HTTP | Fastify 5 |
| Banco | PostgreSQL 16 |
| ORM | Prisma 6 |
| Admin UI | React 18 + Shopify Polaris + App Bridge (CDN) |
| Storefront | Theme App Extension (app embed block) |
| Fila | Tabela `SyncJob` + worker in-process (`FOR UPDATE SKIP LOCKED`) |
| Containerização | Docker multi-stage + docker-compose |
| Deploy | VPS via Coolify |

```
Cliente na loja                 Operador no admin
      │                                │
      ▼                                ▼
Theme App Extension            Admin UI (Polaris)
  (pop-up + preços)              (wizard 3 passos)
      │                                │
      │ App Proxy assinado             │ session token (JWT)
      ▼                                ▼
┌──────────────────────────────────────────────┐
│                  Fastify                     │
│  /proxy/*     /api/*     /webhooks/*  /auth  │
└──────────────────────────────────────────────┘
      │                    │
      ▼                    ▼
  PostgreSQL          Fila SyncJob ──► Shopify Admin API (GraphQL)
 (fonte de verdade)                    (option + variantes + preços)
```

---

## Estrutura do repositório

```
shopify-regional-pricing/
├── src/
│   ├── admin/          rotas da API do admin + verificação do session token
│   ├── storefront/     endpoints do App Proxy + cache de preços
│   ├── shopify/        OAuth, cliente GraphQL, mutations, webhooks, selling plans
│   ├── jobs/           fila de sincronização (sync, backfill, delete, reconcile)
│   ├── db/             Prisma client e criptografia do access token
│   ├── lib/            CEP, matchers de região, cache TTL, dinheiro
│   ├── server.ts       montagem do Fastify
│   └── index.ts        bootstrap e shutdown
├── web/                Admin UI (React + Polaris + Vite) → build em /public
├── extensions/
│   └── regional-pricing/   theme app extension (liquid + js + css)
├── prisma/             schema e migrations
├── scripts/            backup.sh e restore.sh
├── tests/              vitest (CEP, matchers, assinaturas, dinheiro, cripto)
└── docs/               Loop, go-live e guia do operador
```

---

## Rodando localmente

### Pré-requisitos
- Node.js 20+ (o projeto foi validado no 22)
- PostgreSQL 16 (ou `docker compose up postgres`)

### Passos

```bash
cd shopify-regional-pricing

cp .env.example .env
# preencha ao menos:
#   SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL, DATABASE_URL
#   ENCRYPTION_KEY   -> openssl rand -hex 32
#   SESSION_SECRET   -> openssl rand -hex 32

npm install
npx prisma generate
npx prisma migrate deploy

npm run build:web     # compila a Admin UI para ../public
npm run dev           # servidor em modo watch
```

`GET http://localhost:3000/health` deve responder `200` com `"database":"up"`.

### Com Docker

```bash
docker compose up --build
```

Sobe `app` + `postgres`, aplica as migrations no startup do container e expõe
`/health` para o healthcheck.

### Autenticação em desenvolvimento

Fora do iframe do admin da Shopify não existe session token. Com
`ALLOW_DEV_AUTH=true` (proibido em produção — o app se recusa a subir com
`NODE_ENV=production`), a API aceita o header `x-dev-shop: loja.myshopify.com`
e a validação de assinatura do App Proxy é desligada.

### Testes

```bash
npm test          # 65 testes de unidade
npm run typecheck
```

---

## Configuração no Shopify Partners

1. **Criar o app custom** em Partners → Apps → *Create app* → *Custom app*.
2. **App URL:** `https://SEU_APP` (o mesmo valor de `SHOPIFY_APP_URL`).
3. **Allowed redirection URL:** `https://SEU_APP/auth/callback`.
4. **Scopes:** `read_products`, `write_products`, `read_orders`.
5. **App Proxy:**
   - Subpath prefix: `apps`
   - Subpath: `regional-pricing`
   - Proxy URL: `https://SEU_APP/proxy`
6. **Instalar:** acesse `https://SEU_APP/auth?shop=SUA_LOJA.myshopify.com`.
   O app persiste o token criptografado, registra os webhooks e dispara o
   primeiro sync do catálogo.
7. **Publicar a theme app extension:**
   ```bash
   # preencha client_id em shopify.app.toml antes
   npx @shopify/cli app deploy
   ```
   Depois, no tema: **Personalizar → App embeds → Precificação Regional → ativar**.

Preencha `SHOPIFY_SHOP_DOMAIN` no `.env` para travar a instalação em uma única
loja — é um app custom, não faz sentido aceitar qualquer domínio.

---

## Deploy no Coolify

1. **Repositório:** conecte o repositório privado via deploy key.
2. **Build:** aponte para `shopify-regional-pricing/Dockerfile` (build context na
   mesma pasta).
3. **Variáveis de ambiente:** configure todas do `.env.example` no painel do
   Coolify. **Nunca commite o `.env`.**
4. **Banco:** crie um PostgreSQL no Coolify e use a connection string interna em
   `DATABASE_URL`.
5. **HTTPS:** habilite Let's Encrypt no domínio do app. A Shopify exige HTTPS.
6. **Healthcheck:** `GET /health`, intervalo 30s.
7. **Deploy automático:** ative no push da branch `main`.
8. **Backup:** agende `scripts/backup.sh` no cron do host.

As migrations rodam sozinhas no startup (`docker-entrypoint.sh` →
`prisma migrate deploy`), então um deploy que inclui migration não exige
passo manual.

### Observabilidade

Todos os logs saem em JSON no stdout, prontos para o Coolify capturar:

- toda chamada à Admin API, com custo (`requestedCost`, `actualCost`,
  `available`) e duração;
- todo `SyncJob`, com duração, quantidade processada e resultado;
- alerta por webhook quando um job falha (configure a URL em **Configurações**).

Access token e headers de autorização são redigidos pelo logger.

---

## Operação do dia a dia

> **Regra número um:** o operador **nunca** edita variantes no admin nativo da
> Shopify. As variantes existem porque o Shopify exige — são detalhe de
> implementação. Todo preço é gerenciado dentro do app.

### Cadastrar uma região

1. **Regiões → + Cadastrar Região**
2. **Passo 1:** nome + como identificar (faixa de CEP, CEPs específicos, ou
   cidade/estado). Pode combinar vários. O app avisa em tempo real se um CEP já
   pertence a outra região.
3. **Passo 2:** o catálogo inteiro numa tela. Digite os preços, ou use
   **Copiar preços de outra região** (com percentual opcional). Dá para salvar
   rascunho e voltar depois — nada vai para a Shopify ainda.
4. **Passo 3:** revise e **Confirmar e sincronizar**. O progresso aparece no
   painel, atualizado a cada 3s.

### Produto novo criado na loja

O webhook `PRODUCTS_CREATE` enfileira um backfill automático: o produto ganha a
option `Região` e uma variante por região ativa, com o **preço base do produto**
como ponto de partida. O painel de saúde mostra que ele precisa de ajuste.

### Alguém editou uma variante à mão

Use **Saúde → Reconciliar com a Shopify**. O job compara banco × Shopify,
recria variantes faltantes e corrige preços divergentes.

### Excluir uma região

Exige digitar o nome exato da região. As variantes correspondentes são removidas
de todos os produtos e **assinaturas ativas naquela região são afetadas** — o
Loop perde a variante à qual a assinatura está vinculada. Se a região era o
fallback, a configuração de região padrão é limpa junto.

---

## API

### Admin (`/api/*`) — exige session token do App Bridge

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/regions` | painel: regiões com status agregado |
| `POST` | `/api/regions` | cria região (409 em conflito de CEP) |
| `GET/PUT` | `/api/regions/:id` | detalhe e edição |
| `DELETE` | `/api/regions/:id?confirm=<nome>` | exclusão confirmada |
| `POST` | `/api/matchers/validate` | checagem de conflito ao digitar |
| `GET/PUT` | `/api/regions/:id/prices` | tabela de preços e rascunho |
| `POST` | `/api/regions/:id/prices/copy` | copiar de outra região (± %) |
| `POST` | `/api/regions/:id/sync` | confirma e enfileira o sync |
| `POST` | `/api/regions/:id/retry-failed` | reprocessa só os produtos com erro |
| `GET` | `/api/jobs`, `/api/jobs/:id` | progresso do sync (polling) |
| `GET/PUT` | `/api/settings` | pop-up, região padrão, Loop, alertas |
| `GET` | `/api/health/dashboard` | painel de saúde |
| `POST` | `/api/reconcile` | reconciliação banco × Shopify |
| `GET/POST` | `/api/catalog`, `/api/catalog/refresh` | espelho do catálogo |

### Storefront (`/proxy/*`) — exige assinatura do App Proxy

| Método | Rota | Cache |
|---|---|---|
| `GET` | `/proxy/regions` | 60s |
| `POST` | `/proxy/resolve-region` | `no-store` |
| `GET` | `/proxy/prices?regionId=` | `PRICE_CACHE_TTL_SECONDS` (default 300s) |

`/proxy/prices` devolve o mapa chaveado pelo gid do produto, mais os índices
`byHandle` e `byNumericId` — o DOM do tema só expõe handle e id numérico.
O cache em memória é invalidado quando um `SyncJob` daquela região termina.

### Webhooks (`/webhooks/*`) — HMAC verificado sobre o corpo cru

`app_uninstalled`, `products_create`, `products_delete`, e os três de compliance
(`customers_data_request`, `customers_redact`, `shop_redact`).

---

## Decisões de implementação

**Fastify em vez de `@shopify/shopify-app-express`.** O escopo pede Fastify como
preferência, e o SDK de sessão oficial é acoplado ao Express. O fluxo OAuth
(HMAC da query, `state` anti-CSRF em cookie assinado, troca do code pelo token),
a verificação do session token JWT, a assinatura do App Proxy e o HMAC dos
webhooks estão implementados em `src/shopify/crypto.ts`, com **18 testes**
cobrindo inclusive os casos de recusa (segredo errado, token expirado, `aud` de
outro app, `alg: none`, corpo reserializado, domínio `loja.myshopify.com.evil.com`).

**Polaris React está descontinuado.** A Shopify migrou para Polaris web
components. O escopo pediu React + Polaris e é isso que está aqui — funciona e
continua instalável —, mas vale saber que essa camada terá de migrar em algum
momento. Nada mais do app depende disso.

**Estratégia de variantes.** Primeiro produto a receber a precificação:
`productOptionsCreate` com `variantStrategy: LEAVE_AS_IS`, que aproveita a
variante existente (a "Default Title") e atribui a ela o valor da região.
Regiões seguintes: `productOptionUpdate` acrescenta o valor e
`productVariantsBulkCreate` cria a variante. Preço sempre confirmado com
`productVariantsBulkUpdate`. Renomear uma região renomeia o **valor da option**,
preservando os ids das variantes — e portanto as assinaturas do Loop.

**Disponibilidade por região.** Desmarcar "Disponível" mantém o preço cadastrado
mas remove o produto do mapa do storefront, que esconde o botão de compra. Não
zeramos estoque via `inventorySetQuantities`: isso exigiria `write_inventory` e
afetaria o estoque real, que é compartilhado entre as variantes regionais.

**Erro de um produto não derruba o sync.** Cada produto que falha grava o motivo
em `RegionPrice.syncError` e o job segue. O painel de saúde lista os erros e
oferece "Reprocessar produtos com erro".

**Jobs órfãos.** Um deploy no meio de um sync deixaria jobs presos em `running`.
No startup, `requeueStaleJobs()` devolve à fila os que ainda têm tentativas e
marca como falhos os que esgotaram.

---

## Documentos complementares

- [`docs/loop-commerce.md`](docs/loop-commerce.md) — protocolo de validação do
  Loop antes do go-live (Etapa 8)
- [`docs/go-live.md`](docs/go-live.md) — checklist de go-live
- [`docs/operador.md`](docs/operador.md) — guia curto para quem opera a loja
