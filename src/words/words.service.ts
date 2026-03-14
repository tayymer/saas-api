import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// All tiers see all CEFR levels equally
const ALL_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'];
const TIER_CEFR_CONFIG: Record<string, { levels: string[]; ratios: number[] }> = {
  A:      { levels: ALL_CEFR, ratios: [0.20, 0.20, 0.20, 0.20, 0.20] },
  B:      { levels: ALL_CEFR, ratios: [0.20, 0.20, 0.20, 0.20, 0.20] },
  C:      { levels: ALL_CEFR, ratios: [0.20, 0.20, 0.20, 0.20, 0.20] },
  MASTER: { levels: ALL_CEFR, ratios: [0.20, 0.20, 0.20, 0.20, 0.20] },
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

  // ── Session pool: pre-select POOL_SIZE words ─────────────────────────────
  async getSessionPool(
    userId: number,
    language: string,
    tier: string,
    clientRecentIds: number[] = [],
  ) {
    const config = TIER_CEFR_CONFIG[tier] ?? TIER_CEFR_CONFIG['A'];

    // Get recent word IDs from DB (last 30 seen by this user)
    const dbRecent = await this.prisma.wordSeen.findMany({
      where: { userId },
      select: { wordId: true },
      orderBy: { seenAt: 'desc' },
      take: COOLDOWN_COUNT,
    });
    const excludeIds = [
      ...new Set([...clientRecentIds, ...dbRecent.map((w) => w.wordId)]),
    ];

    const pool: any[] = [];

    for (let i = 0; i < config.levels.length; i++) {
      const count  = Math.round(POOL_SIZE * config.ratios[i]);
      const words  = await this.prisma.word.findMany({
        where: {
          language: language as any,
          cefrLevel: config.levels[i],
          isActive:  true,
          ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
        select: {
          id: true, word: true, translation: true,
          category: true, cefrLevel: true, frequencyRank: true,
        },
        orderBy: { frequencyRank: 'asc' },
        take:    count * 3, // fetch extra for shuffling
      });

      // shuffle and take count
      const shuffled = words.sort(() => Math.random() - 0.5).slice(0, count);
      pool.push(...shuffled);
    }

    // If pool is too small (not enough words with exclusions), retry without exclusions
    if (pool.length < 10) {
      return this.getSessionPoolFallback(language, tier);
    }

    return pool.sort(() => Math.random() - 0.5);
  }

  private async getSessionPoolFallback(language: string, tier: string) {
    const config = TIER_CEFR_CONFIG[tier] ?? TIER_CEFR_CONFIG['A'];
    const pool: any[] = [];
    for (const level of config.levels) {
      const words = await this.prisma.word.findMany({
        where: { language: language as any, cefrLevel: level, isActive: true },
        select: { id: true, word: true, translation: true, category: true, cefrLevel: true },
        take: 30,
      });
      pool.push(...words);
    }
    return pool.sort(() => Math.random() - 0.5);
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
    const existing = await this.prisma.wordStats.findUnique({ where: { wordId } });
    if (!existing) {
      await this.prisma.wordStats.create({
        data: {
          wordId,
          correctCount:    correct ? 1 : 0,
          totalCount:      1,
          avgResponseTime: responseTime,
        },
      });
    } else {
      const newTotal   = existing.totalCount + 1;
      const newCorrect = existing.correctCount + (correct ? 1 : 0);
      const newAvg     = (existing.avgResponseTime * existing.totalCount + responseTime) / newTotal;
      await this.prisma.wordStats.update({
        where: { wordId },
        data: { correctCount: newCorrect, totalCount: newTotal, avgResponseTime: newAvg },
      });
    }
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
