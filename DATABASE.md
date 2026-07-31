# DATABASE.md — APEX 4

Postgres via Prisma. Todas as tabelas usam `id UUID @default(uuid())`, `createdAt`,
`updatedAt`; soft delete (`deletedAt`) onde uma exclusão poderia quebrar histórico/ranking
(ex: `User`, `Goal`, `Achievement`) em vez de apagar linhas. O schema real e versionado vive
em `prisma/schema.prisma` — este documento é o mapa de leitura humana.

## 1. Identidade e acesso

- **User** — conta APEX 4. `email`, `passwordHash`, `status` (`ACTIVE`/`SUSPENDED`),
  `launchDate` implícito via `createdAt` (usado para o ranking geral "desde o lançamento").
- **Account/Session** — modelos padrão Auth.js (login credentials + sessões em banco,
  revogáveis).
- **Invite** — `token` único, `email` alvo, `createdById` (admin), `usedById` nullable,
  `expiresAt`, `revokedAt`. Único ponto de entrada de novos usuários.
- **Profile** — 1:1 com `User`: `displayName`, `nickname`, `avatarUrl`, `bio` (frase curta
  opcional), `birthDate`, `weightKg`, `heightCm`, `goal` (texto livre + enum de categoria).
- **UserRole** — `ADMIN` | `PARTICIPANT`. Modelado como tabela (não enum simples no `User`)
  para permitir auditoria de mudança de papel, embora no MVP só exista 1 admin fixo.
- **UserColor** — cor hex escolhida pelo usuário; unique constraint para não colidir entre os
  4 participantes (evita ranking confuso).

## 2. Integração WHOOP

- **WhoopConnection** — 1:1 `User`. `status` (`NOT_CONNECTED`, `CONNECTED`,
  `IMPORTING_HISTORY`, `SYNCING`, `UP_TO_DATE`, `AWAITING_DATA`, `AUTH_ERROR`,
  `TEMP_ERROR`, `RECONNECT_REQUIRED` — seção 7 do brief), `whoopUserId`, `scopesGranted[]`,
  `lastSyncedAt`.
- **WhoopToken** — tokens **criptografados** (AES-256-GCM, chave em `TOKEN_ENCRYPTION_KEY`),
  `accessTokenEnc`, `refreshTokenEnc`, `expiresAt`, `rotatedAt`. Nunca exposto fora do
  backend; nunca serializado para o client.
- **WhoopRawEvent** — payload bruto de cada resposta relevante da API (auditoria/replay),
  `source` (`sync`|`webhook`|`historical`), `payload JSONB`.
- **WhoopWebhookEvent** — evento recebido, `externalEventId` **unique** (idempotência),
  `type`, `receivedAt`, `processedAt`, `status`.
- **WhoopSyncJob** — fila/histórico de execuções de sync (`type`, `status`, `attempts`,
  `lastError`, `startedAt`, `finishedAt`) — alimenta o painel de saúde em `admin/logs`.
- **WhoopSyncCursor** — 1 por `(userId, resource)`: `cursor`, `lastCompletedAt` — permite
  retomar importação histórica sem duplicar.
- **WhoopCycle / WhoopRecovery / WhoopSleep / WhoopWorkout / WhoopBodyMeasurement** — dados
  normalizados (já traduzidos pelo `WhoopNormalizer`), sempre com `externalId` **unique**
  por recurso para upsert idempotente, e `raw JSONB` opcional para depuração.

## 3. Dia competitivo e pontuação

- **DailyPerformance** — a "mesa de trabalho" de um `(userId, competitiveDate)`: agrega
  referências às entidades WHOOP do ciclo correspondente + `JournalEntry` do dia + `status`
  (`IN_PROGRESS`, `AWAITING_SLEEP`, `AWAITING_RECOVERY`, `AWAITING_SYNC`, `CLOSED`,
  `REPROCESSED`, `INCOMPLETE_USER_FAULT`, `INCOMPLETE_TECH_FAULT` — seção 9 do brief).
  `competitiveDate` é derivado do ciclo fisiológico, não da data civil.
- **UserBaseline** — snapshot de linha de base por usuário, recalculado por janela móvel
  (ex: 28d/90d): médias/desvios de sono, HRV, FC repouso, Strain, etc. Versionado por
  `computedAt` para a engine sempre usar a baseline vigente na data do cálculo.
- **ScoringVersion** — versão nomeada do conjunto de regras (`"v1"`, `"v1.1"`...),
  `effectiveFrom`. Nunca editar uma versão publicada — criar nova.
- **ScoringRule** — regras configuráveis por versão (pesos, faixas de Strain, penalidades de
  álcool etc.), `key`, `value JSONB`, `scoringVersionId`.
- **DailyScore** — 1 por `(userId, competitiveDate, scoringVersionId)`. `totalPoints`
  (pode ser negativo), `status`.
- **ScoreComponent** — 1 por categoria (Sono, Recovery, Strain, Consistência, Evolução,
  Hábitos) dentro de um `DailyScore`: `pointsPossible`, `pointsEarned`, `metricUsed`,
  `baselineComparison JSONB`, `explanation` (texto), `recommendation` (texto).
- **ScoreAdjustment** — bônus/penalidades individuais dentro de um componente (ex:
  "cafeína noturna: -1,5"): `type` (`BONUS`|`PENALTY`), `reason`, `points`, `ruleKey`.
- **StrainRecommendation** — faixa recomendada do dia por usuário: `min`, `max`,
  `rationale JSONB` (quais fatores pesaram), calculada antes do treino acontecer.

Toda linha de score guarda `inputValue`, `normalizedValue`, `ruleApplied`, `points`,
`scoringVersionId`, `calculatedAt` — exigido pela seção 13 do brief para auditabilidade.

## 4. Journal e hábitos

- **JournalEntry** — 1 por `(userId, referenceDate)`: `status` (`PENDING`|`SUBMITTED`),
  `submittedAt`, `visibility` (`GROUP`|`PRIVATE`, hoje sempre `GROUP` por decisão do grupo,
  mas modelado para restringir sem migration — seção 18 do brief).
- **Habit** — catálogo fixo inicial (água, alimentação, álcool, sauna, mobilidade,
  alongamento, fisioterapia, meditação, cafeína), `key`, `label`, `responseType`
  (`BOOLEAN_NA` | `SCALE_WATER` | `SCALE_FOOD` | `SCALE_ALCOHOL` | `SCALE_CAFFEINE`).
- **JournalAnswer** — `(journalEntryId, habitId)` → `value` (enum textual conforme o
  `responseType` do hábito).

## 5. Metas

- **Goal** — meta ativa do usuário: `title`, `metric`, `targetValue`, `cycleStartDate`,
  `cycleLengthDays` (padrão 14), `status` (`PENDING_APPROVAL`, `ACTIVE`, `PAUSED`,
  `COMPLETED`, `REJECTED`), `source` (`USER`|`SYSTEM_SUGGESTED`).
- **GoalSuggestion** — proposta gerada pelo sistema antes de virar `Goal` (só vira `Goal`
  após aprovação do usuário — seção 19 do brief).
- **GoalProgress** — snapshot periódico do progresso de uma `Goal` (`date`, `value`,
  `percentComplete`).

## 6. Modo recuperação

- **RecoveryMode** — `type` (`INJURED`|`SICK`|`GENERAL_RECOVERY`), `reason`,
  `startDate`, `endDate` (obrigatório na ativação), `limitations`, `allowedActivities`,
  `forbiddenActivities`, `notes`, `status` (`ACTIVE`|`ENDED`|`EXTENDED`). Histórico completo
  preservado (nunca deletado) para "o grupo pode ver tipo, período e status" (seção 20).

## 7. Ranking, conquistas, provocações

- **RankingSnapshot** — materialização diária de `(scope, periodKey, userId, points,
  position)` para `scope ∈ {DAILY, WEEKLY, MONTHLY, ALL_TIME}` — evita recalcular agregações
  pesadas a cada view (seção 34, performance).
- **Achievement** — catálogo de conquistas (nome, descrição, ícone, raridade, regra
  `JSONB`, período aplicável).
- **UserAchievement** — concessão a um usuário (`achievementId`, `userId`, `metricSnapshot`,
  `earnedAt`).
- **Roast** (provocação) — `templateKey`, `renderedText`, `targetUserId`, `triggerMetric
  JSONB`, `date` — guarda o texto final e os fatos que motivaram, para nunca repetir a mesma
  combinação em sequência.

## 8. Sistema

- **NotificationInternal** — notificações internas ao produto (ex: "Journal pendente"),
  nunca push externo no MVP.
- **AuditLog** — `actorId`, `action`, `targetType`, `targetId`, `metadata JSONB`,
  `createdAt` — toda ação administrativa sensível.
- **AppSetting** — chave/valor de configuração global (timezone, data de lançamento do
  ranking geral, etc.).
- **DisplayConfiguration** — ordem das telas do telão, intervalo em segundos, telas
  habilitadas.

## 9. Índices e constraints notáveis

- `Invite.token`, `WhoopWebhookEvent.externalEventId`, `WhoopCycle/Recovery/Sleep/
  Workout.externalId` — todos **unique** (idempotência é requisito de segurança, não só de
  qualidade).
- `DailyScore` unique em `(userId, competitiveDate, scoringVersionId)`.
- `JournalEntry` unique em `(userId, referenceDate)`.
- `RankingSnapshot` unique em `(scope, periodKey, userId)`.
- Índices compostos em `(userId, competitiveDate)` nas tabelas de telemetria WHOOP — é o
  padrão de acesso mais comum (linha do tempo por usuário).

## 10. Migrations e seed

- `prisma/migrations/*` — histórico versionado, nunca editar uma migration já aplicada em
  ambiente compartilhado.
- `prisma/seed.ts` — cria os 4 usuários fictícios (`Rafa`, `Bia`, `Theo`, `Manu`), perfis,
  cores, `ScoringVersion "v1"` com `ScoringRule` default, e gera dados simulados
  correlacionados (ver `SCORING.md §7` e seção 28 do brief) para permitir desenvolver toda a
  Fase 2 sem depender da WHOOP.
