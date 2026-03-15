import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Language, LegendRank, Tier } from '@prisma/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY_PP_CAP = 400;

const RANK_PP_THRESHOLDS: Record<LegendRank, number> = {
  LEGEND_V:    0,
  LEGEND_IV:   10,    // TEST — production: 800
  LEGEND_III:  20,    // TEST — production: 1800
  LEGEND_II:   35,    // TEST — production: 3200
  LEGEND_I:    50,    // TEST — production: 4600
  WORD_MASTER: 99999, // PP ile kazanılmaz, top10 ile
};

const RANK_ORDER: LegendRank[] = [
  'LEGEND_V', 'LEGEND_IV', 'LEGEND_III', 'LEGEND_II', 'LEGEND_I', 'WORD_MASTER',
];

// PP formula: milestone-based — 5→+1, 10→+2, 15→+3, 20→+4, …
// Her 5'lik milestone bir öncekinden 1 fazla PP verir.
function calculateStreakPP(streak: number): number {
  let total = 0;
  for (let milestone = 5; milestone <= streak; milestone += 5) {
    total += milestone / 5;
  }
  return total;
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
        data: { userId, language, shields: 3 },
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
      profile = await this.prisma.legendProfile.create({ data: { userId, language, shields: 3 } });
    }

    // Count today's runs for diminishing returns
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRuns = await this.prisma.legendRun.count({
      where: { userId, language, playedAt: { gte: todayStart } },
    });
    const dailyRunIndex = todayRuns + 1;

    // Calculate PP: 1 PP per 5 correct (spec-compliant)
    let earnedPP = calculateStreakPP(streak);

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

    // Can mantığı — her başarısız run 1 can kırar (usedContinue ise kırmaz)
    let shieldDrained = false;
    let ppLost        = 0;
    let demoted       = false;

    if (!usedContinue) {
      const freshProfile = await this.prisma.legendProfile.findUnique({
        where: { userId_language: { userId, language } },
      });
      // null veya 0 ise 3'e resetle (migration default'u uygulanmamış olabilir)
      const rawShields = freshProfile?.shields ?? profile.shields;
      const currentShields = (rawShields === null || rawShields === undefined) ? 3 : rawShields;

      if (currentShields <= 0) {
        // Stuck state: shields 0'da kalmış — demote et, resetle
        await this.prisma.legendProfile.update({
          where: { userId_language: { userId, language } },
          data:  { shields: 3 },
        });
        shieldDrained = true;
        demoted       = true;
      } else {
        const newShields = currentShields - 1;
        if (newShields === 0) {
          // Son can → demote, canları sıfırla
          await this.prisma.legendProfile.update({
            where: { userId_language: { userId, language } },
            data:  { shields: 3 },
          });
          shieldDrained = true;
          demoted       = true;
        } else {
          await this.prisma.legendProfile.update({
            where: { userId_language: { userId, language } },
            data:  { shields: newShields },
          });
          shieldDrained = true;
        }
      }

      // Demote olunca UserProgress tier'ını C seviye 1'e (display) düşür
      // step=5 → display level = 6-5 = 1 (Altın 1)
      // LEGEND_IV+ oyuncuları korumalı — Efsane liginden düşürülmez
      const PROTECTED_RANKS: LegendRank[] = ['LEGEND_IV', 'LEGEND_III', 'LEGEND_II', 'LEGEND_I', 'WORD_MASTER'];
      if (demoted && !PROTECTED_RANKS.includes(newRank)) {
        await this.prisma.userProgress.updateMany({
          where: { userId, language },
          data:  { tier: Tier.C, step: 5, xp: 0 },
        });
      } else if (demoted && PROTECTED_RANKS.includes(newRank)) {
        // Korumalı rank: canları sıfırla ama tier düşürme
        demoted = false;
      }
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
