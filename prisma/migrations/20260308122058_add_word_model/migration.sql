-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'SPANISH');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('A', 'B', 'C', 'MASTER');

-- CreateTable
CREATE TABLE "Word" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "tier" "Tier" NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Word_language_word_key" ON "Word"("language", "word");
