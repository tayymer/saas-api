-- Legend League migration

CREATE TYPE "LegendRank" AS ENUM ('LEGEND_V', 'LEGEND_IV', 'LEGEND_III', 'LEGEND_II', 'LEGEND_I', 'WORD_MASTER');

-- LegendProfile: per-user per-language legend state
CREATE TABLE IF NOT EXISTS "LegendProfile" (
  "id"               SERIAL PRIMARY KEY,
  "userId"           INTEGER NOT NULL,
  "language"         "Language" NOT NULL,
  "rank"             "LegendRank" NOT NULL DEFAULT 'LEGEND_V',
  "shields"          INTEGER NOT NULL DEFAULT 3,
  "lifetimePrestige" INTEGER NOT NULL DEFAULT 0,
  "bestStreak"       INTEGER NOT NULL DEFAULT 0,
  "totalRuns"        INTEGER NOT NULL DEFAULT 0,
  "lastShieldAt"     TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegendProfile_userId_language_key" UNIQUE ("userId", "language"),
  CONSTRAINT "LegendProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- LegendSeason: 14-day season per language
CREATE TABLE IF NOT EXISTS "LegendSeason" (
  "id"        SERIAL PRIMARY KEY,
  "number"    INTEGER NOT NULL,
  "language"  "Language" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate"   TIMESTAMP(3) NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "LegendSeason_number_language_key" UNIQUE ("number", "language")
);

-- LegendSeasonEntry: per-user per-season leaderboard entry
CREATE TABLE IF NOT EXISTS "LegendSeasonEntry" (
  "id"           SERIAL PRIMARY KEY,
  "userId"       INTEGER NOT NULL,
  "seasonId"     INTEGER NOT NULL,
  "language"     "Language" NOT NULL,
  "seasonPP"     INTEGER NOT NULL DEFAULT 0,
  "rank"         "LegendRank" NOT NULL DEFAULT 'LEGEND_V',
  "finalRank"    INTEGER,
  "isWordMaster" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LegendSeasonEntry_userId_seasonId_key" UNIQUE ("userId", "seasonId"),
  CONSTRAINT "LegendSeasonEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegendSeasonEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "LegendSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- LegendRun: each individual streak run
CREATE TABLE IF NOT EXISTS "LegendRun" (
  "id"            SERIAL PRIMARY KEY,
  "userId"        INTEGER NOT NULL,
  "language"      "Language" NOT NULL,
  "streak"        INTEGER NOT NULL DEFAULT 0,
  "ppEarned"      INTEGER NOT NULL DEFAULT 0,
  "usedContinue"  BOOLEAN NOT NULL DEFAULT false,
  "dailyRunIndex" INTEGER NOT NULL DEFAULT 1,
  "playedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegendRun_profile_fkey" FOREIGN KEY ("userId", "language") REFERENCES "LegendProfile"("userId", "language") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed first season for both languages (starting today)
INSERT INTO "LegendSeason" ("number", "language", "startDate", "endDate", "isActive")
VALUES
  (1, 'ENGLISH', NOW(), NOW() + INTERVAL '14 days', true),
  (1, 'SPANISH', NOW(), NOW() + INTERVAL '14 days', true)
ON CONFLICT DO NOTHING;
