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

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL, AUTH_SECRET, TOKEN_ENCRYPTION_KEY

# banco local de desenvolvimento (Postgres embarcado do Prisma — não precisa Docker/Neon):
npx prisma dev -d

npx prisma migrate dev
npm run seed            # cria admin + 4 atletas fictícios com 90 dias de dados simulados

npm run dev             # http://localhost:3000
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
npm run seed         # popular banco com dados de demonstração
npx prisma studio    # inspecionar o banco
```

## Status

Fase 1 (Fundação) concluída — ver [`ROADMAP.md`](./ROADMAP.md) para o que vem a seguir
(Fase 2: MVP com dados simulados — rankings, Journal, metas, provocações, conquistas, modo
telão).

Modo mock ativo por padrão (`WHOOP_MODE=mock`): a conexão WHOOP no onboarding/perfil simula
o fluxo sem exigir credenciais reais, até a Fase 3.
