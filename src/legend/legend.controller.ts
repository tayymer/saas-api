import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { LegendService } from './legend.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Language } from '@prisma/client';

@Controller('legend')
export class LegendController {
  constructor(private readonly legendService: LegendService) {}

  // GET /legend/profile?language=ENGLISH
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req, @Query('language') language: Language) {
    return this.legendService.getProfile(req.user.userId, language ?? 'ENGLISH');
  }

  // POST /legend/run
  // body: { language, streak, usedContinue }
  @UseGuards(JwtAuthGuard)
  @Post('run')
  submitRun(
    @Request() req,
    @Body() body: { language: Language; streak: number; usedContinue?: boolean },
  ) {
    return this.legendService.submitRun(
      req.user.userId,
      body.language ?? 'ENGLISH',
      body.streak,
      body.usedContinue ?? false,
    );
  }

  // GET /legend/leaderboard?language=ENGLISH
  @Get('leaderboard')
  getLeaderboard(@Query('language') language: Language) {
    return this.legendService.getLeaderboard(language ?? 'ENGLISH');
  }

  // GET /legend/rank?language=ENGLISH  (kendi sırası)
  @UseGuards(JwtAuthGuard)
  @Get('rank')
  getPlayerRank(@Request() req, @Query('language') language: Language) {
    return this.legendService.getPlayerRank(req.user.userId, language ?? 'ENGLISH');
  }
}
