import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  getProgress(@Request() req: any) {
    return this.progressService.getOrCreateProgress(req.user.id);
  }

  @Post('xp')
  addXp(@Request() req: any, @Body() body: { streak: number }) {
    return this.progressService.addXp(req.user.id, body.streak);
  }

  @Post('fail')
  handleFail(@Request() req: any) {
    return this.progressService.handleRunFail(req.user.id);
  }
}