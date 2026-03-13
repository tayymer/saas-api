-- AddColumn frequencyRank to Word
ALTER TABLE "Word" ADD COLUMN IF NOT EXISTS "frequencyRank" INTEGER NOT NULL DEFAULT 999;

-- AddColumn isActive to Word
ALTER TABLE "Word" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable WordSeen
CREATE TABLE IF NOT EXISTS "WordSeen" (
  "id" SERIAL NOT NULL,
  "wordId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WordSeen_pkey" PRIMARY KEY ("id")
);

-- CreateTable WordStats
CREATE TABLE IF NOT EXISTS "WordStats" (
  "wordId" INTEGER NOT NULL,
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "skipCount" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "WordStats_pkey" PRIMARY KEY ("wordId")
);

-- CreateIndex on Word
CREATE INDEX IF NOT EXISTS "Word_language_cefrLevel_isActive_idx" ON "Word"("language", "cefrLevel", "isActive");

-- CreateIndex on WordSeen
CREATE INDEX IF NOT EXISTS "WordSeen_userId_seenAt_idx" ON "WordSeen"("userId", "seenAt");

-- AddForeignKey WordSeen -> Word
ALTER TABLE "WordSeen" ADD CONSTRAINT "WordSeen_wordId_fkey"
  FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey WordStats -> Word
ALTER TABLE "WordStats" ADD CONSTRAINT "WordStats_wordId_fkey"
  FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
