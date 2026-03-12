-- Add language column to UserProgress with default ENGLISH
ALTER TABLE "UserProgress" ADD COLUMN "language" "Language" NOT NULL DEFAULT 'ENGLISH';

-- Drop old unique index on userId alone
DROP INDEX "UserProgress_userId_key";

-- Add new composite unique constraint on (userId, language)
CREATE UNIQUE INDEX "UserProgress_userId_language_key" ON "UserProgress" ("userId", "language");
