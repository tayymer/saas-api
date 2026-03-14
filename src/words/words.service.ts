import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Tier → CEFR mapping: harder words as you advance
const TIER_CEFR_CONFIG: Record<string, { levels: string[]; ratios: number[] }> = {
  A:      { levels: ['A1', 'A2'],     ratios: [0.70, 0.30] },
  B:      { levels: ['A2', 'B1'],     ratios: [0.50, 0.50] },
  C:      { levels: ['B1', 'B2'],     ratios: [0.40, 0.60] },
  MASTER: { levels: ['B2', 'C1'],     ratios: [0.40, 0.60] },
};

const VALID_LANGUAGES = ['ENGLISH', 'SPANISH'];
const VALID_CEFR      = ['A1', 'A2', 'B1', 'B2', 'C1'];
const POOL_SIZE       = 60; // words pre-selected per session
const COOLDOWN_COUNT  = 30; // last N words excluded

@Injectable()
export class WordsService {
  constructor(private prisma: PrismaService) {}

  // ── Legacy: single-word fetch (backward compat) ─────────────────────────
  async getWords(language: string, tier: string, cefrLevel?: string) {
    return this.prisma.word.findMany({
      where: {
        language: language as any,
        tier:     tier as any,
        isActive: true,
        ...(cefrLevel ? { cefrLevel } : {}),
      },
      select: { id: true, word: true, translation: true, category: true, cefrLevel: true },
    });
  }

  // ── Session pool: CEFR-weighted per tier, ORDER BY RANDOM() ──────────────
  async getSessionPool(
    userId: number | null,
    language: string,
    tier: string,
    clientRecentIds: number[] = [],
  ) {
    const config = TIER_CEFR_CONFIG[tier] ?? TIER_CEFR_CONFIG['A'];

    const dbRecent = userId
      ? await this.prisma.wordSeen.findMany({
          where: { userId },
          select: { wordId: true },
          orderBy: { seenAt: 'desc' },
          take: COOLDOWN_COUNT,
        })
      : [];
    const excludeIds = [
      ...new Set([...clientRecentIds, ...dbRecent.map((w) => w.wordId)]),
    ];

    const excludeClause =
      excludeIds.length > 0
        ? Prisma.sql`AND id NOT IN (${Prisma.join(excludeIds)})`
        : Prisma.sql``;

    const pool: any[] = [];

    for (let i = 0; i < config.levels.length; i++) {
      const count = Math.round(POOL_SIZE * config.ratios[i]);
      const level = config.levels[i];
      const words = await this.prisma.$queryRaw<any[]>`
        SELECT id, word, translation, category, "cefrLevel", "frequencyRank"
        FROM "Word"
        WHERE language = ${language}::"Language"
          AND "cefrLevel" = ${level}
          AND "isActive" = true
          ${excludeClause}
        ORDER BY RANDOM()
        LIMIT ${count}
      `;
      pool.push(...words);
    }

    if (pool.length < 10) {
      return this.getSessionPoolFallback(language);
    }

    return pool.sort(() => Math.random() - 0.5);
  }

  private async getSessionPoolFallback(language: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT id, word, translation, category, "cefrLevel", "frequencyRank"
      FROM "Word"
      WHERE language = ${language}::"Language"
        AND "isActive" = true
      ORDER BY RANDOM()
      LIMIT ${POOL_SIZE}
    `;
  }

  // ── Mark word as seen ────────────────────────────────────────────────────
  async markWordSeen(userId: number, wordId: number) {
    await this.prisma.wordSeen.create({ data: { userId, wordId } });
    // Keep only last 100 entries per user to avoid unbounded growth
    const old = await this.prisma.wordSeen.findMany({
      where: { userId },
      orderBy: { seenAt: 'desc' },
      skip: 100,
      select: { id: true },
    });
    if (old.length > 0) {
      await this.prisma.wordSeen.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
    return { ok: true };
  }

  // ── Record word answer stats ─────────────────────────────────────────────
  async recordWordAnswer(wordId: number, correct: boolean, responseTime: number) {
    const inc = correct ? 1 : 0;
    await this.prisma.$executeRaw`
      INSERT INTO "WordStats" ("wordId", "correctCount", "totalCount", "avgResponseTime")
      VALUES (${wordId}, ${inc}, 1, ${responseTime})
      ON CONFLICT ("wordId") DO UPDATE SET
        "correctCount"    = "WordStats"."correctCount" + ${inc},
        "totalCount"      = "WordStats"."totalCount" + 1,
        "avgResponseTime" = ("WordStats"."avgResponseTime" * "WordStats"."totalCount" + ${responseTime})
                            / ("WordStats"."totalCount" + 1)
    `;
    return { ok: true };
  }

  // ── Bulk import ──────────────────────────────────────────────────────────
  async bulkImport(words: {
    word: string;
    translation: string;
    language: string;
    cefrLevel: string;
    category?: string;
    frequencyRank?: number;
  }[]) {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const w of words) {
      if (!VALID_LANGUAGES.includes(w.language)) {
        errors.push(`Invalid language: ${w.language} for word: ${w.word}`);
        skipped++;
        continue;
      }
      if (!VALID_CEFR.includes(w.cefrLevel)) {
        errors.push(`Invalid CEFR: ${w.cefrLevel} for word: ${w.word}`);
        skipped++;
        continue;
      }

      // Map CEFR to tier for backward compat
      const tier = cefrToTier(w.cefrLevel);

      try {
        await this.prisma.word.upsert({
          where: { language_word: { language: w.language as any, word: w.word.toLowerCase().trim() } },
          create: {
            word:          w.word.toLowerCase().trim(),
            translation:   w.translation.trim(),
            language:      w.language as any,
            cefrLevel:     w.cefrLevel,
            tier:          tier as any,
            category:      w.category ?? 'general',
            frequencyRank: w.frequencyRank ?? 999,
            isActive:      true,
          },
          update: {
            translation:   w.translation.trim(),
            cefrLevel:     w.cefrLevel,
            category:      w.category ?? 'general',
            frequencyRank: w.frequencyRank ?? 999,
          },
        });
        created++;
      } catch (e) {
        skipped++;
        errors.push(`Failed: ${w.word}`);
      }
    }

    return { created, skipped, errors: errors.slice(0, 20) };
  }

  // ── Admin: get all words with filters ────────────────────────────────────
  async getAllWords(filters?: {
    language?: string;
    cefrLevel?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = filters?.page  ?? 1;
    const limit = filters?.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (filters?.language)  where.language  = filters.language;
    if (filters?.cefrLevel) where.cefrLevel = filters.cefrLevel;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) where.word = { contains: filters.search, mode: 'insensitive' };

    const [words, total] = await Promise.all([
      this.prisma.word.findMany({
        where,
        select: {
          id: true, word: true, translation: true,
          language: true, cefrLevel: true, isActive: true,
          frequencyRank: true, category: true, createdAt: true,
          stats: { select: { correctCount: true, totalCount: true, avgResponseTime: true } },
        },
        orderBy: [{ language: 'asc' }, { cefrLevel: 'asc' }, { frequencyRank: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.word.count({ where }),
    ]);

    return { words, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Admin: toggle active ─────────────────────────────────────────────────
  async toggleActive(id: number, isActive: boolean) {
    return this.prisma.word.update({
      where: { id },
      data: { isActive },
      select: { id: true, word: true, isActive: true },
    });
  }

  // ── Admin: update word ───────────────────────────────────────────────────
  async updateWord(
    id: number,
    data: Partial<{
      translation: string;
      cefrLevel: string;
      category: string;
      frequencyRank: number;
      isActive: boolean;
    }>,
  ) {
    if (data.cefrLevel && !VALID_CEFR.includes(data.cefrLevel)) {
      throw new BadRequestException(`Invalid CEFR level: ${data.cefrLevel}`);
    }
    const updateData: any = { ...data };
    if (data.cefrLevel) updateData.tier = cefrToTier(data.cefrLevel);
    return this.prisma.word.update({ where: { id }, data: updateData });
  }

  // ── Stats summary ─────────────────────────────────────────────────────────
  async getWordStats() {
    const [total, byLanguage, byCefr] = await Promise.all([
      this.prisma.word.count(),
      this.prisma.word.groupBy({ by: ['language'], _count: true }),
      this.prisma.word.groupBy({ by: ['cefrLevel'], _count: true, orderBy: { cefrLevel: 'asc' } }),
    ]);
    return { total, byLanguage, byCefr };
  }

  // ── Legacy ─────────────────────────────────────────────────────────────────
  async updateCefrLevel(id: number, cefrLevel: string) {
    return this.prisma.word.update({
      where: { id },
      data: { cefrLevel, tier: cefrToTier(cefrLevel) as any },
      select: { id: true, word: true, cefrLevel: true },
    });
  }
}

function cefrToTier(cefrLevel: string): string {
  const map: Record<string, string> = {
    A1: 'A', A2: 'A', B1: 'B', B2: 'C', C1: 'MASTER',
  };
  return map[cefrLevel] ?? 'A';
}
