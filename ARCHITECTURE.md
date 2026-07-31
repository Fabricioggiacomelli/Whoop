# ARCHITECTURE.md — APEX 4

## 1. Visão geral

Monólito modular em Next.js (App Router), TypeScript estrito, rodando em Vercel. Um único
banco Postgres (Neon). Redis (Upstash) para cache, rate limiting e fila leve. Sem
microserviços — 4 usuários não justificam a complexidade operacional, e o App Router já
separa bem UI (Server/Client Components), mutações (Server Actions) e endpoints externos
(Route Handlers, usados para OAuth callback e webhooks, que precisam de URL pública estável).

```
Browser (PWA) ─┬─> Server Components (leitura, RSC)
               ├─> Server Actions (mutações internas: Journal, metas, perfil, admin)
               └─> Route Handlers (/api/whoop/*, /api/webhooks/*, /api/cron/*)
                        │
                        ├─> WhoopClient (HTTP para api.prod.whoop.com)
                        ├─> services/* (regras de negócio, puras/testáveis)
                        └─> Prisma ─> Postgres (Neon)
                                 └─> Upstash Redis (cache, filas, rate limit)
```

Regra de dependência: **rotas e componentes nunca falam com Prisma ou com a WHOOP
diretamente** — sempre passam por uma camada de serviço em `src/server/services/*`. Isso é o
que torna a engine de pontuação e a integração WHOOP testáveis sem subir Next.js.

## 2. Árvore de pastas (Fase 1 em diante)

```
apex4/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  └─ invite/[token]/page.tsx
│  │  ├─ (onboarding)/onboarding/page.tsx
│  │  ├─ (app)/                      ← área logada, com nav inferior
│  │  │  ├─ layout.tsx               ← shell mobile + bottom nav
│  │  │  ├─ home/page.tsx
│  │  │  ├─ ranking/page.tsx
│  │  │  ├─ ranking/[date]/score/page.tsx
│  │  │  ├─ categorias/page.tsx
│  │  │  ├─ evolucao/page.tsx
│  │  │  ├─ metas/page.tsx
│  │  │  ├─ journal/page.tsx
│  │  │  └─ perfil/page.tsx
│  │  ├─ admin/                      ← guard de role=ADMIN
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  ├─ convites/page.tsx
│  │  │  ├─ usuarios/page.tsx
│  │  │  ├─ pontuacao/page.tsx
│  │  │  ├─ logs/page.tsx
│  │  │  └─ telao/page.tsx
│  │  ├─ display/                    ← telão, sem chrome padrão
│  │  │  ├─ layout.tsx
│  │  │  └─ page.tsx
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/route.ts
│  │     ├─ whoop/oauth/start/route.ts
│  │     ├─ whoop/oauth/callback/route.ts
│  │     ├─ webhooks/whoop/route.ts
│  │     └─ cron/
│  │        ├─ reconcile/route.ts
│  │        └─ close-days/route.ts
│  ├─ components/
│  │  ├─ ui/                         ← shadcn/ui primitives
│  │  ├─ layout/                     ← BottomNav, Header, Shell
│  │  ├─ charts/
│  │  └─ journal/
│  ├─ server/
│  │  ├─ auth.ts                     ← config Auth.js
│  │  ├─ db.ts                       ← singleton PrismaClient
│  │  ├─ redis.ts
│  │  ├─ services/
│  │  │  ├─ invite.service.ts
│  │  │  ├─ user.service.ts
│  │  │  ├─ journal.service.ts
│  │  │  ├─ goal.service.ts
│  │  │  ├─ recoveryMode.service.ts
│  │  │  ├─ ranking.service.ts
│  │  │  ├─ achievement.service.ts
│  │  │  └─ roast.service.ts
│  │  ├─ whoop/
│  │  │  ├─ whoop.client.ts          ← WhoopClient (HTTP puro)
│  │  │  ├─ whoop.auth.ts            ← WhoopAuthService (OAuth, tokens)
│  │  │  ├─ whoop.sync.ts            ← WhoopSyncService (orquestra sync)
│  │  │  ├─ whoop.webhook.ts         ← WhoopWebhookService
│  │  │  ├─ whoop.normalizer.ts      ← WhoopNormalizer (payload externo → tipos internos)
│  │  │  ├─ whoop.historicalImporter.ts
│  │  │  └─ whoop.types.ts           ← tipos internos, isolados do formato externo
│  │  └─ scoring/
│  │     ├─ engine.ts                ← orquestra os scorers, monta DailyScore
│  │     ├─ sleep.scorer.ts
│  │     ├─ recovery.scorer.ts
│  │     ├─ strain.scorer.ts
│  │     ├─ consistency.scorer.ts
│  │     ├─ evolution.scorer.ts
│  │     ├─ habit.scorer.ts
│  │     ├─ overtraining.penalty.ts
│  │     ├─ missingData.penalty.ts
│  │     ├─ recoveryModeAdjustment.ts
│  │     └─ baseline.ts              ← UserBaseline (janela móvel)
│  ├─ lib/                           ← utils puros (datas, timezone, formatação)
│  └─ types/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ public/ (ícones PWA, manifest)
├─ docs/ (este conjunto de .md, versionado)
├─ .env.example
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

## 3. Camada de abstração WHOOP

Nenhum código fora de `src/server/whoop/*` conhece o formato de resposta da WHOOP. Fluxo:

- `WhoopClient` — wrapper HTTP fino (fetch com auth header, retry/backoff, rate-limit aware).
  Não sabe nada de regras de negócio.
- `WhoopAuthService` — troca `code` por tokens, refresh, revogação, criptografia em
  repouso (`WhoopToken`), prevenção de refresh concorrente (lock via Redis).
- `WhoopSyncService` — orquestra: decide o que buscar (cursor, janela), chama `WhoopClient`,
  passa resultado para `WhoopNormalizer`, persiste via Prisma, dispara recomputo de score.
- `WhoopWebhookService` — recebe evento, valida, grava bruto (`WhoopRawEvent`), enfileira
  busca do objeto completo (nunca confia no payload do webhook como fonte de verdade).
- `WhoopNormalizer` — única função com `if (campo da API mudou)`. Produz os tipos internos
  (`WhoopCycle`, `WhoopRecovery`, `WhoopSleep`, `WhoopWorkout`, `WhoopBodyMeasurement` do
  Prisma), independente de como a API nomeia os campos.
- `WhoopHistoricalImporter` — usa `WhoopSyncCursor` para paginar, retomar após falha, e
  marcar progresso visível na UI (`WhoopConnection.status`).

Isso significa: se a WHOOP mudar a v2 da API amanhã, o blast radius é um arquivo.

## 4. Engine de pontuação (visão arquitetural — regras completas em SCORING.md)

`engine.ts` recebe `(userId, date, scoringVersion)` e:

1. carrega `DailyPerformance` do dia (dados normalizados da WHOOP + Journal do dia);
2. carrega `UserBaseline` vigente;
3. roda cada `*Scorer` de forma independente e pura — `(input, baseline, rules) => ScoreComponent`;
4. aplica penalidades/bônus (`OvertrainingPenalty`, `MissingDataPenalty`,
   `RecoveryModeAdjustment`);
5. soma tudo em `DailyScore`, salvando cada `ScoreComponent`/`ScoreAdjustment` com o valor de
   entrada, valor normalizado, regra aplicada, pontos e versão;
6. é **idempotente**: rodar de novo para o mesmo (usuário, dia, versão) sobrescreve
   determinísticamente, nunca acumula.

Cada `*Scorer` é uma função pura testável sem banco — recebe dados já carregados, devolve um
`ScoreComponent`. Isso é o que viabiliza os testes unitários exigidos na seção 27 do brief.

## 5. Design system

- **Cor de fundo**: `#05070A` (quase preto, levemente azulado — sensação de cockpit).
- **Cartões**: grafite `#14181F` / `#1B1F27` com borda 1px `#242933` (hairline, não sombra
  pesada — evita "dashboard admin genérico").
- **Texto primário**: `#F5F6F8`. **Texto secundário**: `#8A8F99`.
- **Recovery**: verde `#3DDC84`, amarelo `#F5C542`, vermelho `#FF5C5C` — reservados
  exclusivamente para semântica de Recovery/estado, nunca decorativos.
- **Cor por usuário**: campo livre (`UserColor`), usada em avatar, gráficos e destaques do
  próprio usuário — nunca em elementos de sistema.
- **Tipografia**: Inter (UI) + uma mono (JetBrains Mono/Geist Mono) para números/telemetria —
  números tabulares sempre em mono para não "dançar" ao atualizar.
- **Motion**: Framer Motion, durações 120–220ms, easing `easeOut`, sem bounce — rápido e
  discreto, nunca lúdico. Respeitar `prefers-reduced-motion`.
- **Densidade**: hierarquia forte — um número grande por card, contexto pequeno abaixo. Sem
  grids de 6+ métricas competindo por atenção.

Tokens vivem em `tailwind.config.ts` (`theme.extend.colors.apex.*`) e em CSS vars para
permitir a cor-por-usuário ser aplicada dinamicamente sem rebuild.

## 6. Autenticação e autorização

- Auth.js (NextAuth v5), provider Credentials, sessões em banco (tabela `Session`, não JWT)
  — permite ao admin revogar acesso instantaneamente (requisito indireto de "remover
  participante").
- Proxy (`src/proxy.ts`, convenção do Next.js 16 que substitui `middleware.ts`) protege
  `(app)/*`, `admin/*`; `admin/*` checa
  `UserRole === ADMIN` no server, nunca só no client.
- `WhoopConnection`/`WhoopToken` pertencem 1:1 ao `User` autenticado no APEX 4 — nunca há
  cross-user access a tokens.

## 7. Modo telão — arquitetura

Rota `/display`, sem layout de app normal (sem bottom nav). Client Component com:

- `useDisplayCarousel` — hook de estado (tela atual, pausado, intervalo configurável via
  `DisplayConfiguration`), navegação por teclado/touch, auto-hide de controles após 4s de
  inatividade.
- Dados via polling leve (SWR/React Query, `revalidate` curto) em vez de WebSocket no MVP —
  suficiente para um telão de sala, evita infra de realtime. Reavaliar se necessário.
- Telas (componentes independentes, plugáveis na ordem configurada pelo admin): Grid Geral,
  Corrida da Semana, Telemetria, Campeões, Conquistas, Sem Piedade, Pit Wall.

## 8. Ambientes

- `development` — banco Neon branch `dev`, WHOOP em modo mock (`WHOOP_MODE=mock`).
- `staging` — branch Neon `staging`, WHOOP sandbox/real com dados de teste, deploy preview do
  Vercel.
- `production` — branch Neon `main`, WHOOP real, domínio próprio.

`WHOOP_MODE=mock` faz `WhoopClient` responder com fixtures determinísticas em
`src/server/whoop/__mocks__`, permitindo desenvolver toda a Fase 1/2 sem credenciais reais —
exigido pela seção 38 do brief.

## 9. Observabilidade

- Logs estruturados (JSON) via um logger fino (`src/lib/logger.ts`) — nunca loga tokens,
  senhas ou payloads brutos de auth.
- `AuditLog` para ações administrativas e de segurança (convite criado/revogado, modo
  recuperação ativado, reprocessamento manual, login falho).
- `WhoopSyncJob` guarda status/tentativas/erros por execução — base do painel de saúde da
  integração em `admin/logs`.
