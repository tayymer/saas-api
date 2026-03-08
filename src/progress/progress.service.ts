import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG, XP_PER_CORRECT, XP_STREAK_BONUS, XP_STREAK_INTERVAL } from './game.constants';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateProgress(userId: number) {
    let progress = await this.prisma.userProgress.findUnique({
      where: { userId },
    });
    if (!progress) {
      progress = await this.prisma.userProgress.create({
        data: { userId },
      });
    }
    return progress;
  }

  async addXp(userId: number, streak: number) {
    const progress = await this.getOrCreateProgress(userId);
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

    if (threshold && newXp >= threshold) {
      xpAfter = 0;
      leveledUp = true;

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
      where: { userId },
      data: {
        xp: xpAfter,
        totalXp: newTotalXp,
        step: newStep,
        level: newLevel,
        tier: newTier,
        failStreak: 0, // Başarılı oyun → failStreak sıfırla
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

  async handleRunFail(userId: number) {
    const progress = await this.getOrCreateProgress(userId);

    const newFailStreak = (progress.failStreak ?? 0) + 1;
    let stepDown = false;
    let newStep = progress.step;
    let newLevel = progress.level;
    let resetFailStreak = newFailStreak;

    // 3 üst üste fail → adım 5'e geri düş
    if (newFailStreak >= 3) {
      resetFailStreak = 0;
      if (progress.step < 5) {
        stepDown = true;
        newStep = 5;
        newLevel = 5;
      }
    }

    const updated = await this.prisma.userProgress.update({
      where: { userId },
      data: {
        xp: 0,
        step: newStep,
        level: newLevel,
        failStreak: resetFailStreak,
      },
    });

    return {
      progress: updated,
      stepDown,
      failStreak: newFailStreak,
    };
  }

  async resetProgress(userId: number) {
    return this.prisma.userProgress.upsert({
      where: { userId },
      update: { tier: 'A', level: 1, step: 1, xp: 0, totalXp: 0, failStreak: 0 },
      create: { userId, tier: 'A', level: 1, step: 1, xp: 0, totalXp: 0, failStreak: 0 },
    });
  }

  private getNextTier(currentTier: string): string | null {
    if (currentTier === 'A') return 'B';
    if (currentTier === 'B') return 'C';
    if (currentTier === 'C') return 'MASTER';
    return null;
  }
}
