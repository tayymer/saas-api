import { Controller, Get, Post, Delete, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type Language = 'ENGLISH' | 'SPANISH';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  getProgress(@Request() req: any, @Query('language') language?: Language) {
    return this.progressService.getOrCreateProgress(req.user.userId, language || 'ENGLISH');
  }

  @Post('xp')
  addXp(@Request() req: any, @Body() body: { streak: number; language?: Language }) {
    return this.progressService.addXp(req.user.userId, body.streak, body.language || 'ENGLISH');
  }

  @Post('fail')
  handleFail(@Request() req: any, @Body() body: { language?: Language }) {
    return this.progressService.handleRunFail(req.user.userId, body?.language || 'ENGLISH');
  }

  @Post('continue')
  continueWithStars(
    @Request() req: any,
    @Body() body: { language?: Language; restoreTier: string; restoreStep: number; cost?: number },
  ) {
    return this.progressService.continueWithStars(
      req.user.userId,
      body.language || 'ENGLISH',
      body.restoreTier,
      body.restoreStep,
      body.cost || 120,
    );
  }

  @Delete('reset')
  async resetProgress(@Request() req: any, @Query('language') language?: Language) {
    return this.progressService.resetProgress(req.user.userId, language || 'ENGLISH');
  }
}
