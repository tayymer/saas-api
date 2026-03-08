import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG, TIER_UNLOCK_LEVEL, XP_PER_CORRECT, XP_STREAK_BONUS, XP_STREAK_INTERVAL } from './game.constants';

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
        newLevel++;
      } else {
        // Tier geçişi
        const nextTier = this.getNextTier(progress.tier, newLevel);
        if (nextTier) {
          newTier = nextTier as any;
          newStep = 1;
          newLevel++;
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
    const newStep = Math.max(1, progress.step - 1);
    const newLevel = Math.max(1, progress.level - 1);

    return this.prisma.userProgress.update({
      where: { userId },
      data: { xp: 0, step: newStep, level: newLevel },
    });
  }

  private getNextTier(currentTier: string, level: number): string | null {
    if (currentTier === 'A' && level >= TIER_UNLOCK_LEVEL.B) return 'B';
    if (currentTier === 'B' && level >= TIER_UNLOCK_LEVEL.C) return 'C';
    if (currentTier === 'C' && level >= TIER_UNLOCK_LEVEL.MASTER) return 'MASTER';
    return null;
  }
}