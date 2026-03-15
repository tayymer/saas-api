import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG, XP_PER_CORRECT, XP_STREAK_BONUS, XP_STREAK_INTERVAL } from './game.constants';

type Language = 'ENGLISH' | 'SPANISH';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateProgress(userId: number, language: Language = 'ENGLISH') {
    let progress = await this.prisma.userProgress.findUnique({
      where: { userId_language: { userId, language } },
    });
    if (!progress) {
      progress = await this.prisma.userProgress.create({
        data: { userId, language },
      });
    }
    return progress;
  }

  async addXp(userId: number, streak: number, language: Language = 'ENGLISH') {
    const progress = await this.getOrCreateProgress(userId, language);
    const bonus = streak % XP_STREAK_INTERVAL === 0 ? XP_STREAK_BONUS : 0;
    const earned = XP_PER_CORRECT + bonus;
    const newXp = progress.xp + earned;
    const newTotalXp = progress.totalXp + earned;

    const tierCfg = TIER_CONFIG[progress.tier];
    const threshold = tierCfg.xpThresholds[progress.step - 1];

    let newStep = progress.step;
    let newLevel = progress.level;
    let newTier = progress.tier;
    let xpAfter = newXp;
    let leveledUp = false;

    let failStreakAfter = progress.failStreak ?? 0;

    if (threshold && newXp >= threshold) {
      xpAfter = 0;
      leveledUp = true;
      failStreakAfter = 0;

      if (newStep < tierCfg.steps) {
        newStep++;
        newLevel = newStep;
      } else {
        const nextTier = this.getNextTier(progress.tier);
        if (nextTier) {
          newTier = nextTier as any;
          newStep = 1;
          newLevel = 1;
        }
      }
    }

    const updated = await this.prisma.userProgress.update({
      where: { userId_language: { userId, language } },
      data: {
        xp: xpAfter,
        totalXp: newTotalXp,
        step: newStep,
        level: newLevel,
        tier: newTier,
        failStreak: failStreakAfter,
      },
    });

    return {
      progress: updated,
      earned,
      bonus,
      leveledUp,
      tierChanged: newTier !== progress.tier,
      oldTier: progress.tier,
      newTier,
    };
  }

  async handleRunFail(userId: number, language: Language = 'ENGLISH') {
    const progress = await this.getOrCreateProgress(userId, language);

    let newStep = progress.step;
    let newLevel = progress.level;
    let newTier = progress.tier;
    let tierDown = false;
    let newFailStreak = Number(progress.failStreak ?? 0);
    let resetFailStreak = newFailStreak;

    if (progress.step > 1) {
      newStep = progress.step - 1;
      resetFailStreak = 0;
    } else {
      resetFailStreak = newFailStreak + 1;

      if (resetFailStreak >= 3) {
        const prevTier = this.getPrevTier(progress.tier);
        if (prevTier) {
          newTier = prevTier as any;
          newStep = 5;
          newLevel = progress.level;
          tierDown = true;
          resetFailStreak = 0;
        }
      }
    }

    const updated = await this.prisma.userProgress.update({
      where: { userId_language: { userId, language } },
      data: {
        xp: 0,
        step: newStep,
        level: newLevel,
        tier: newTier,
        failStreak: resetFailStreak,
      },
    });

    return {
      progress: updated,
      tierDown,
      stepDown: newStep < progress.step || tierDown,
      failStreak: resetFailStreak,
    };
  }

  async continueWithStars(
    userId: number,
    language: Language = 'ENGLISH',
    restoreTier: string,
    restoreStep: number,
    cost: number = 120,
  ) {
    const progress = await this.getOrCreateProgress(userId, language);

    if (progress.totalXp < cost) {
      return { success: false, reason: 'insufficient_stars', totalXp: progress.totalXp };
    }

    const updated = await this.prisma.userProgress.update({
      where: { userId_language: { userId, language } },
      data: {
        totalXp: progress.totalXp - cost,
        tier: restoreTier as any,
        step: restoreStep,
        level: restoreStep,
        xp: 0,
        failStreak: 0,
      },
    });

    return { success: true, progress: updated, deducted: cost };
  }

  async addStars(userId: number, language: Language = 'ENGLISH', amount: number) {
    const progress = await this.getOrCreateProgress(userId, language);
    const updated = await this.prisma.userProgress.update({
      where: { userId_language: { userId, language } },
      data: { totalXp: progress.totalXp + amount },
    });
    return { totalXp: updated.totalXp };
  }

  async resetProgress(userId: number, language: Language = 'ENGLISH') {
    return this.prisma.userProgress.upsert({
      where: { userId_language: { userId, language } },
      update: { tier: 'A', level: 1, step: 1, xp: 0, totalXp: 0, failStreak: 0 },
      create: { userId, language, tier: 'A', level: 1, step: 1, xp: 0, totalXp: 0, failStreak: 0 },
    });
  }

  private getNextTier(currentTier: string): string | null {
    if (currentTier === 'A') return 'B';
    if (currentTier === 'B') return 'C';
    if (currentTier === 'C') return 'MASTER';
    return null;
  }

  private getPrevTier(currentTier: string): string | null {
    if (currentTier === 'B') return 'A';
    if (currentTier === 'C') return 'B';
    if (currentTier === 'MASTER') return 'C';
    return null;
  }
}
