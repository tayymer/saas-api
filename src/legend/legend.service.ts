import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Language, LegendRank } from '@prisma/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY_PP_CAP = 400;

const RANK_PP_THRESHOLDS: Record<LegendRank, number> = {
  LEGEND_V:    0,
  LEGEND_IV:   800,
  LEGEND_III:  1800,
  LEGEND_II:   3200,
  LEGEND_I:    4600,
  WORD_MASTER: 99999, // PP ile kazanılmaz, top10 ile
};

const RANK_ORDER: LegendRank[] = [
  'LEGEND_V', 'LEGEND_IV', 'LEGEND_III', 'LEGEND_II', 'LEGEND_I', 'WORD_MASTER',
];

// Diminishing returns: runs 1-5 → 100%, 6-10 → 70%, 11-20 → 40%, 21+ → 10%
function getDiminishingMultiplier(runIndex: number): number {
  if (runIndex <= 5)  return 1.0;
  if (runIndex <= 10) return 0.7;
  if (runIndex <= 20) return 0.4;
  return 0.1;
}

// Daily boost: run 1 → 1.5x, run 2 → 1.3x, run 3 → 1.1x, run 4+ → 1.0x
function getDailyBoostMultiplier(runIndex: number): number {
  if (runIndex === 1) return 1.5;
  if (runIndex === 2) return 1.3;
  if (runIndex === 3) return 1.1;
  return 1.0;
}

// PP formula: base 5 per correct + milestone bonuses
function calculateStreakPP(streak: number): number {
  if (streak < 5) return 0;
  const base = streak * 5;
  let bonus = 0;
  if (streak >= 5)  bonus += 15;
  if (streak >= 10) bonus += 35;
  if (streak >= 20) bonus += 75;
  if (streak >= 30) bonus += 150;
  if (streak >= 50) bonus += 300;
  return base + bonus;
}

function getRankForPP(pp: number): LegendRank {
  let rank: LegendRank = 'LEGEND_V';
  for (const r of RANK_ORDER) {
    if (r === 'WORD_MASTER') break;
    if (pp >= RANK_PP_THRESHOLDS[r]) rank = r;
  }
  return rank;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class LegendService {
  constructor(private prisma: PrismaService) {}

  // ── Get or create legend profile ──────────────────────────────────────────
  async getProfile(userId: number, language: Language) {
    let profile = await this.prisma.legendProfile.findUnique({
      where: { userId_language: { userId, language } },
    });
    if (!profile) {
      profile = await this.prisma.legendProfile.create({
        data: { userId, language },
      });
    }
    // Refresh shields (1 per 24h, max 3)
    profile = await this.refreshShields(profile);

    const season = await this.getActiveSeason(language);
    let entry = null;
    if (season) {
      entry = await this.getOrCreateSeasonEntry(userId, season.id, language);
    }

    return { profile, season, entry };
  }

  // ── Submit a completed run ─────────────────────────────────────────────────
  async submitRun(
    userId: number,
    language: Language,
    streak: number,
    usedContinue: boolean,
  ) {
    let profile = await this.prisma.legendProfile.findUnique({
      where: { userId_language: { userId, language } },
    });
    if (!profile) {
      profile = await this.prisma.legendProfile.create({ data: { userId, language } });
    }

    // Count today's runs for diminishing returns
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRuns = await this.prisma.legendRun.count({
      where: { userId, language, playedAt: { gte: todayStart } },
    });
    const dailyRunIndex = todayRuns + 1;

    // Calculate PP
    const rawPP   = calculateStreakPP(streak);
    const dimMult = getDiminishingMultiplier(dailyRunIndex);
    const boostMult = getDailyBoostMultiplier(dailyRunIndex);
    const combinedMult = dailyRunIndex <= 3 ? boostMult : dimMult;
    let earnedPP  = Math.round(rawPP * combinedMult);

    // Apply daily cap
    const todayPP = await this.getTodayPP(userId, language);
    const remaining = Math.max(0, DAILY_PP_CAP - todayPP);
    earnedPP = Math.min(earnedPP, remaining);

    // Save run
    await this.prisma.legendRun.create({
      data: { userId, language, streak, ppEarned: earnedPP, usedContinue, dailyRunIndex },
    });

    // Update profile
    const newLifetime = profile.lifetimePrestige + earnedPP;
    const newBest     = Math.max(profile.bestStreak, streak);
    await this.prisma.legendProfile.update({
      where:  { userId_language: { userId, language } },
      data: {
        lifetimePrestige: newLifetime,
        bestStreak:       newBest,
        totalRuns:        { increment: 1 },
      },
    });

    // Update season entry
    const season = await this.getActiveSeason(language);
    let newSeasonPP = 0;
    let newRank: LegendRank = 'LEGEND_V';
    if (season) {
      const entry = await this.getOrCreateSeasonEntry(userId, season.id, language);
      newSeasonPP = entry.seasonPP + earnedPP;
      newRank     = getRankForPP(newSeasonPP);
      await this.prisma.legendSeasonEntry.update({
        where: { userId_seasonId: { userId, seasonId: season.id } },
        data:  { seasonPP: newSeasonPP, rank: newRank },
      });
    }

    // Can mantığı — kötü seri (streak < 5) can kırar
    let shieldDrained = false;
    let ppLost        = 0;
    let demoted       = false;

    if (streak < 5) {
      const freshProfile = await this.prisma.legendProfile.findUnique({
        where: { userId_language: { userId, language } },
      });
      const currentShields = freshProfile?.shields ?? profile.shields;

      if (currentShields > 0) {
        await this.prisma.legendProfile.update({
          where: { userId_language: { userId, language } },
          data:  { shields: { decrement: 1 } },
        });
        shieldDrained = true;
      }
      // Can 0 ise hiçbir şey yapmıyoruz (demotion yok)
    }

    // Güncel can sayısını hesapla
    const updatedProfile = await this.prisma.legendProfile.findUnique({
      where: { userId_language: { userId, language } },
    });
    const shieldsRemaining = updatedProfile?.shields ?? 0;

    return {
      ppEarned:         earnedPP,
      ppLost,
      seasonPP:         newSeasonPP,
      rank:             newRank,
      shieldDrained,
      shieldsRemaining,
      demoted,
      dailyCapHit:      remaining === 0,
      dailyRunIndex,
    };
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────
  async getLeaderboard(language: Language, limit = 100) {
    const season = await this.getActiveSeason(language);
    if (!season) return { season: null, entries: [] };

    const entries = await this.prisma.legendSeasonEntry.findMany({
      where:   { seasonId: season.id, language },
      orderBy: { seasonPP: 'desc' },
      take:    limit,
      include: { user: { select: { id: true, name: true } } },
    });

    return {
      season,
      entries: entries.map((e, i) => ({
        rank:        i + 1,
        userId:      e.userId,
        name:        e.user.name,
        seasonPP:    e.seasonPP,
        legendRank:  e.rank,
        isWordMaster: e.isWordMaster,
      })),
    };
  }

  // ── Player leaderboard rank ────────────────────────────────────────────────
  async getPlayerRank(userId: number, language: Language) {
    const season = await this.getActiveSeason(language);
    if (!season) return null;

    const entry = await this.prisma.legendSeasonEntry.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    });
    if (!entry) return null;

    const rank = await this.prisma.legendSeasonEntry.count({
      where: { seasonId: season.id, language, seasonPP: { gt: entry.seasonPP } },
    });
    return rank + 1;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getActiveSeason(language: Language) {
    return this.prisma.legendSeason.findFirst({
      where: { language, isActive: true, endDate: { gt: new Date() } },
      orderBy: { number: 'desc' },
    });
  }

  private async getOrCreateSeasonEntry(userId: number, seasonId: number, language: Language) {
    return this.prisma.legendSeasonEntry.upsert({
      where:  { userId_seasonId: { userId, seasonId } },
      update: {},
      create: { userId, seasonId, language },
    });
  }

  private async getTodayPP(userId: number, language: Language): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const result = await this.prisma.legendRun.aggregate({
      where:   { userId, language, playedAt: { gte: todayStart } },
      _sum:    { ppEarned: true },
    });
    return result._sum.ppEarned ?? 0;
  }

  private async refreshShields(profile: any) {
    if (profile.shields >= 3) return profile;
    if (!profile.lastShieldAt) {
      return this.prisma.legendProfile.update({
        where: { id: profile.id },
        data:  { shields: 3, lastShieldAt: new Date() },
      });
    }
    const hoursSince = (Date.now() - new Date(profile.lastShieldAt).getTime()) / 3600000;
    const toAdd      = Math.min(Math.floor(hoursSince / 24), 3 - profile.shields);
    if (toAdd <= 0) return profile;
    return this.prisma.legendProfile.update({
      where: { id: profile.id },
      data:  { shields: Math.min(profile.shields + toAdd, 3), lastShieldAt: new Date() },
    });
  }
}
