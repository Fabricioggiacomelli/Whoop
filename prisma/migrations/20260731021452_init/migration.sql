-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('SLEEP', 'RECOVERY', 'STRAIN', 'HABITS', 'CONSISTENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "WhoopConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'IMPORTING_HISTORY', 'SYNCING', 'UP_TO_DATE', 'AWAITING_DATA', 'AUTH_ERROR', 'TEMP_ERROR', 'RECONNECT_REQUIRED');

-- CreateEnum
CREATE TYPE "WhoopEventSource" AS ENUM ('SYNC', 'WEBHOOK', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "WebhookProcessStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('HISTORICAL_IMPORT', 'WEBHOOK_PROCESS', 'RECONCILIATION', 'TOKEN_REFRESH');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "DailyPerformanceStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_SLEEP', 'AWAITING_RECOVERY', 'AWAITING_SYNC', 'CLOSED', 'REPROCESSED', 'INCOMPLETE_USER_FAULT', 'INCOMPLETE_TECH_FAULT');

-- CreateEnum
CREATE TYPE "DailyScoreStatus" AS ENUM ('DRAFT', 'FINAL', 'REPROCESSED');

-- CreateEnum
CREATE TYPE "ScoreCategory" AS ENUM ('SLEEP', 'RECOVERY', 'STRAIN', 'CONSISTENCY', 'EVOLUTION', 'HABITS');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('BONUS', 'PENALTY');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('PENDING', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "JournalVisibility" AS ENUM ('GROUP', 'PRIVATE');

-- CreateEnum
CREATE TYPE "HabitResponseType" AS ENUM ('BOOLEAN_NA', 'SCALE_WATER', 'SCALE_FOOD', 'SCALE_ALCOHOL', 'SCALE_CAFFEINE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GoalSource" AS ENUM ('USER', 'SYSTEM_SUGGESTED');

-- CreateEnum
CREATE TYPE "RecoveryModeType" AS ENUM ('INJURED', 'SICK', 'GENERAL_RECOVERY');

-- CreateEnum
CREATE TYPE "RecoveryModeStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "RankingScope" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARTICIPANT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "birthDate" TIMESTAMP(3),
    "weightKg" DECIMAL(5,2),
    "heightCm" DECIMAL(5,2),
    "goalText" TEXT,
    "goalCategory" "GoalCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_colors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whoopUserId" TEXT,
    "status" "WhoopConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "scopesGranted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_tokens" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_raw_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "source" "WhoopEventSource" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whoop_raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_webhook_events" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookProcessStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "whoop_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_sync_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whoop_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_sync_cursors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "cursor" TEXT,
    "lastCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_sync_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_cycles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "strain" DECIMAL(4,2),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_recoveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "recoveryScore" DECIMAL(5,2),
    "hrvMs" DECIMAL(6,2),
    "restingHeartRate" DECIMAL(5,2),
    "skinTempCelsius" DECIMAL(4,2),
    "spo2Percentage" DECIMAL(5,2),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_sleeps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT,
    "externalId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "isNap" BOOLEAN NOT NULL DEFAULT false,
    "sleepPerformancePct" DECIMAL(5,2),
    "sleepEfficiencyPct" DECIMAL(5,2),
    "sleepNeedMinutes" INTEGER,
    "timeInBedMinutes" INTEGER,
    "remMinutes" INTEGER,
    "deepMinutes" INTEGER,
    "lightMinutes" INTEGER,
    "awakeMinutes" INTEGER,
    "disturbanceCount" INTEGER,
    "sleepDebtMinutes" INTEGER,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_sleeps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sportName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "strain" DECIMAL(4,2),
    "averageHeartRate" DECIMAL(5,2),
    "maxHeartRate" DECIMAL(5,2),
    "kilojoules" DECIMAL(10,2),
    "zoneDurations" JSONB,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whoop_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_body_measurements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "heightMeters" DECIMAL(4,2),
    "weightKg" DECIMAL(5,2),
    "maxHeartRate" INTEGER,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whoop_body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_performances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competitiveDate" DATE NOT NULL,
    "cycleId" TEXT,
    "journalEntryId" TEXT,
    "status" "DailyPerformanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_baselines" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avgSleepPerfPct" DECIMAL(5,2),
    "avgHrvMs" DECIMAL(6,2),
    "avgRestingHr" DECIMAL(5,2),
    "avgRecoveryScore" DECIMAL(5,2),
    "avgStrain" DECIMAL(4,2),
    "acuteLoad7d" DECIMAL(6,2),
    "chronicLoad28d" DECIMAL(6,2),
    "metadata" JSONB,

    CONSTRAINT "user_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_versions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" TEXT NOT NULL,
    "scoringVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyPerformanceId" TEXT NOT NULL,
    "competitiveDate" DATE NOT NULL,
    "scoringVersionId" TEXT NOT NULL,
    "totalPoints" DECIMAL(6,2) NOT NULL,
    "status" "DailyScoreStatus" NOT NULL DEFAULT 'FINAL',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_components" (
    "id" TEXT NOT NULL,
    "dailyScoreId" TEXT NOT NULL,
    "category" "ScoreCategory" NOT NULL,
    "pointsPossible" DECIMAL(5,2) NOT NULL,
    "pointsEarned" DECIMAL(5,2) NOT NULL,
    "inputValue" JSONB,
    "normalizedValue" JSONB,
    "metricUsed" TEXT,
    "baselineComparison" JSONB,
    "explanation" TEXT,
    "recommendation" TEXT,
    "ruleApplied" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_adjustments" (
    "id" TEXT NOT NULL,
    "scoreComponentId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "points" DECIMAL(5,2) NOT NULL,
    "ruleKey" TEXT NOT NULL,

    CONSTRAINT "score_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strain_recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competitiveDate" DATE NOT NULL,
    "min" DECIMAL(4,2) NOT NULL,
    "max" DECIMAL(4,2) NOT NULL,
    "rationale" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strain_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceDate" DATE NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "JournalVisibility" NOT NULL DEFAULT 'GROUP',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "responseType" "HabitResponseType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_answers" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "journal_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "targetValue" DECIMAL(8,2),
    "category" "GoalCategory" NOT NULL DEFAULT 'OTHER',
    "source" "GoalSource" NOT NULL DEFAULT 'USER',
    "status" "GoalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "cycleStartDate" DATE NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "targetValue" DECIMAL(8,2),
    "category" "GoalCategory" NOT NULL DEFAULT 'OTHER',
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resultingGoalId" TEXT,

    CONSTRAINT "goal_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_progress" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "percentComplete" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "goal_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_modes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RecoveryModeType" NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "limitations" TEXT,
    "allowedActivities" TEXT,
    "forbiddenActivities" TEXT,
    "notes" TEXT,
    "status" "RecoveryModeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" TEXT NOT NULL,
    "scope" "RankingScope" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" DECIMAL(8,2) NOT NULL,
    "position" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "rarity" "AchievementRarity" NOT NULL DEFAULT 'COMMON',
    "rule" JSONB NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "periodLabel" TEXT,
    "metricSnapshot" JSONB,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roasts" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "renderedText" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "triggerMetric" JSONB,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_internal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_internal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "display_configurations" (
    "id" TEXT NOT NULL,
    "screenOrder" TEXT[],
    "intervalSeconds" INTEGER NOT NULL DEFAULT 12,
    "enabledScreens" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "display_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invites_usedById_key" ON "invites"("usedById");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_nickname_key" ON "profiles"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "user_colors_userId_key" ON "user_colors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_colors_hex_key" ON "user_colors"("hex");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_connections_userId_key" ON "whoop_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_connections_whoopUserId_key" ON "whoop_connections"("whoopUserId");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_tokens_connectionId_key" ON "whoop_tokens"("connectionId");

-- CreateIndex
CREATE INDEX "whoop_raw_events_userId_resource_idx" ON "whoop_raw_events"("userId", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_webhook_events_externalEventId_key" ON "whoop_webhook_events"("externalEventId");

-- CreateIndex
CREATE INDEX "whoop_sync_jobs_userId_status_idx" ON "whoop_sync_jobs"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_sync_cursors_userId_resource_key" ON "whoop_sync_cursors"("userId", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_cycles_externalId_key" ON "whoop_cycles"("externalId");

-- CreateIndex
CREATE INDEX "whoop_cycles_userId_startedAt_idx" ON "whoop_cycles"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_recoveries_cycleId_key" ON "whoop_recoveries"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_recoveries_externalId_key" ON "whoop_recoveries"("externalId");

-- CreateIndex
CREATE INDEX "whoop_recoveries_userId_idx" ON "whoop_recoveries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_sleeps_cycleId_key" ON "whoop_sleeps"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_sleeps_externalId_key" ON "whoop_sleeps"("externalId");

-- CreateIndex
CREATE INDEX "whoop_sleeps_userId_startedAt_idx" ON "whoop_sleeps"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_workouts_externalId_key" ON "whoop_workouts"("externalId");

-- CreateIndex
CREATE INDEX "whoop_workouts_userId_startedAt_idx" ON "whoop_workouts"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "whoop_body_measurements_externalId_key" ON "whoop_body_measurements"("externalId");

-- CreateIndex
CREATE INDEX "whoop_body_measurements_userId_measuredAt_idx" ON "whoop_body_measurements"("userId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_performances_journalEntryId_key" ON "daily_performances"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_performances_userId_competitiveDate_key" ON "daily_performances"("userId", "competitiveDate");

-- CreateIndex
CREATE INDEX "user_baselines_userId_computedAt_idx" ON "user_baselines"("userId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_versions_key_key" ON "scoring_versions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_scoringVersionId_key_key" ON "scoring_rules"("scoringVersionId", "key");

-- CreateIndex
CREATE INDEX "daily_scores_competitiveDate_idx" ON "daily_scores"("competitiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_scores_userId_competitiveDate_scoringVersionId_key" ON "daily_scores"("userId", "competitiveDate", "scoringVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "score_components_dailyScoreId_category_key" ON "score_components"("dailyScoreId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "strain_recommendations_userId_competitiveDate_key" ON "strain_recommendations"("userId", "competitiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_userId_referenceDate_key" ON "journal_entries"("userId", "referenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "habits_key_key" ON "habits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "journal_answers_journalEntryId_habitId_key" ON "journal_answers"("journalEntryId", "habitId");

-- CreateIndex
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goal_suggestions_resultingGoalId_key" ON "goal_suggestions"("resultingGoalId");

-- CreateIndex
CREATE UNIQUE INDEX "goal_progress_goalId_date_key" ON "goal_progress"("goalId", "date");

-- CreateIndex
CREATE INDEX "recovery_modes_userId_status_idx" ON "recovery_modes"("userId", "status");

-- CreateIndex
CREATE INDEX "ranking_snapshots_scope_periodKey_position_idx" ON "ranking_snapshots"("scope", "periodKey", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshots_scope_periodKey_userId_key" ON "ranking_snapshots"("scope", "periodKey", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");

-- CreateIndex
CREATE INDEX "roasts_targetUserId_date_idx" ON "roasts"("targetUserId", "date");

-- CreateIndex
CREATE INDEX "notifications_internal_userId_readAt_idx" ON "notifications_internal"("userId", "readAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_colors" ADD CONSTRAINT "user_colors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_connections" ADD CONSTRAINT "whoop_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_tokens" ADD CONSTRAINT "whoop_tokens_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "whoop_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_raw_events" ADD CONSTRAINT "whoop_raw_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_sync_jobs" ADD CONSTRAINT "whoop_sync_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_sync_cursors" ADD CONSTRAINT "whoop_sync_cursors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_cycles" ADD CONSTRAINT "whoop_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_recoveries" ADD CONSTRAINT "whoop_recoveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_recoveries" ADD CONSTRAINT "whoop_recoveries_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "whoop_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_sleeps" ADD CONSTRAINT "whoop_sleeps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_sleeps" ADD CONSTRAINT "whoop_sleeps_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "whoop_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_workouts" ADD CONSTRAINT "whoop_workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whoop_body_measurements" ADD CONSTRAINT "whoop_body_measurements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_performances" ADD CONSTRAINT "daily_performances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_performances" ADD CONSTRAINT "daily_performances_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_baselines" ADD CONSTRAINT "user_baselines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_rules" ADD CONSTRAINT "scoring_rules_scoringVersionId_fkey" FOREIGN KEY ("scoringVersionId") REFERENCES "scoring_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_scores" ADD CONSTRAINT "daily_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_scores" ADD CONSTRAINT "daily_scores_dailyPerformanceId_fkey" FOREIGN KEY ("dailyPerformanceId") REFERENCES "daily_performances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_scores" ADD CONSTRAINT "daily_scores_scoringVersionId_fkey" FOREIGN KEY ("scoringVersionId") REFERENCES "scoring_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_components" ADD CONSTRAINT "score_components_dailyScoreId_fkey" FOREIGN KEY ("dailyScoreId") REFERENCES "daily_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_scoreComponentId_fkey" FOREIGN KEY ("scoreComponentId") REFERENCES "score_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strain_recommendations" ADD CONSTRAINT "strain_recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_answers" ADD CONSTRAINT "journal_answers_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_answers" ADD CONSTRAINT "journal_answers_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_suggestions" ADD CONSTRAINT "goal_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_modes" ADD CONSTRAINT "recovery_modes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roasts" ADD CONSTRAINT "roasts_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_internal" ADD CONSTRAINT "notifications_internal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
