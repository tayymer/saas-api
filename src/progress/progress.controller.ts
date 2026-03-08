import { Controller, Get, Post, Delete, Body, Request, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  getProgress(@Request() req: any) {
    return this.progressService.getOrCreateProgress(req.user.userId);
  }

  @Post('xp')
  addXp(@Request() req: any, @Body() body: { streak: number }) {
    return this.progressService.addXp(req.user.userId, body.streak);
  }

  @Post('fail')
  handleFail(@Request() req: any) {
    return this.progressService.handleRunFail(req.user.userId);
  }

  @Delete('reset')
  async resetProgress(@Request() req: any) {
    console.log('USER:', req.user);
    return this.progressService.resetProgress(req.user.userId);
  }
  
}