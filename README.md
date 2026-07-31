# APEX 4

**Compete. Recover. Evolve.**

Plataforma privada de competição e evolução física integrada à WHOOP, para um grupo fechado
de 4 participantes. Sem feed, sem chat, sem rede social — telemetria, pontuação, ranking e
provocação.

A visão completa do produto, arquitetura, schema, engine de pontuação, integração WHOOP,
segurança e roadmap estão documentados em:

- [`PLAN.md`](./PLAN.md) — plano mestre, decisões, riscos, wireframes textuais
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitetura, árvore de pastas, design system
- [`DATABASE.md`](./DATABASE.md) — modelo de dados (schema completo em `prisma/schema.prisma`)
- [`SCORING.md`](./SCORING.md) — engine de pontuação
- [`WHOOP_INTEGRATION.md`](./WHOOP_INTEGRATION.md) — OAuth, sync, webhooks
- [`SECURITY.md`](./SECURITY.md) — modelo de ameaça, variáveis de ambiente
- [`ROADMAP.md`](./ROADMAP.md) — fases e critérios de aceite

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · Prisma + PostgreSQL · Auth.js
(convite-only) · Upstash Redis · Vitest.

## Rodando localmente

Use um PostgreSQL de verdade — local (instalado nativamente ou via Docker) ou uma branch de
dev do Neon. **Não use `npx prisma dev`** (o Postgres embarcado do Prisma, PGlite atrás de um
proxy fino): em teste real ele derrubou conexões sob uso sustentado ("Connection terminated
unexpectedly"), inadequado para navegar no app por mais que alguns comandos rápidos de
migration/seed.

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL, AUTH_SECRET, TOKEN_ENCRYPTION_KEY

# Windows sem Docker: instale localmente via winget (uma vez só)
winget install --id PostgreSQL.PostgreSQL.17 --source winget --silent \
  --accept-package-agreements --accept-source-agreements \
  --override "--mode unattended --unattendedmodeui minimal --superpassword postgres --serverport 5432"

# crie o banco do projeto
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 5432 -U postgres -c "CREATE DATABASE apex4;"

# DATABASE_URL no .env: postgresql://postgres:postgres@localhost:5432/apex4?schema=public

npx prisma migrate deploy   # ou "migrate dev" se for alterar o schema
npm run seed                # cria admin + 4 atletas fictícios com 90 dias de dados simulados
npm run backfill-scores     # roda a engine de pontuação sobre os 90 dias
npm run recompute-rankings  # materializa os rankings diário/semanal/mensal/geral
npm run generate-roasts     # gera provocações e avalia conquistas

npm run dev                 # http://localhost:3000
```

O `npm run seed` cria a conta admin usando `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (default:
o e-mail configurado no ambiente, senha `Apex4Admin!2026` — troque em produção) e os 4
atletas fictícios (`rafa@apex4.dev`, `bia@apex4.dev`, `theo@apex4.dev`, `manu@apex4.dev`,
senha `Apex4Demo!2026`).

## Scripts

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run seed               # popular banco com dados de demonstração
npm run backfill-scores    # calcular DailyScore para todo o histórico fechado
npm run recompute-rankings # materializar RankingSnapshot (diário/semanal/mensal/geral)
npm run generate-roasts    # gerar provocações + avaliar conquistas
npx prisma studio          # inspecionar o banco
```

## Status

Fase 1 (Fundação) e Fase 2 (MVP com dados simulados) concluídas — engine de pontuação real,
rankings, Journal, Metas, Modo Recuperação, provocações, conquistas, gráficos de evolução e
modo telão, todos rodando sobre os 90 dias simulados dos 4 atletas. Ver
[`ROADMAP.md`](./ROADMAP.md) para o que vem a seguir (Fase 3: integração real com a WHOOP).

Modo mock ativo por padrão (`WHOOP_MODE=mock`): a conexão WHOOP no onboarding/perfil simula
o fluxo sem exigir credenciais reais, até a Fase 3.
