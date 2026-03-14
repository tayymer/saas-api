import {
  Controller, Get, Post, Patch, Query, Param, Body,
  ParseIntPipe,
} from '@nestjs/common';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  // ── Game endpoints ────────────────────────────────────────────────────────

  // Legacy single-word fetch (backward compat)
  @Get()
  getWords(
    @Query('language') language: string = 'ENGLISH',
    @Query('tier') tier: string = 'A',
    @Query('cefr_level') cefrLevel?: string,
  ) {
    return this.wordsService.getWords(language, tier, cefrLevel);
  }

  // Session pool: pre-select 60 words for a game session
  @Get('session')
  getSessionPool(
    @Query('userId') userIdStr?: string,
    @Query('language') language: string = 'ENGLISH',
    @Query('tier') tier: string = 'A',
    @Query('recentIds') recentIds?: string,
  ) {
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;
    const clientRecentIds = recentIds
      ? recentIds.split(',').map(Number).filter(Boolean)
      : [];
    return this.wordsService.getSessionPool(userId, language, tier, clientRecentIds);
  }

  // Mark word as seen (call after each question)
  @Post('seen')
  markWordSeen(
    @Body('userId') userId: number,
    @Body('wordId') wordId: number,
  ) {
    return this.wordsService.markWordSeen(userId, wordId);
  }

  // Record answer stats
  @Post('stats')
  recordStats(
    @Body('wordId') wordId: number,
    @Body('correct') correct: boolean,
    @Body('responseTime') responseTime: number,
  ) {
    return this.wordsService.recordWordAnswer(wordId, correct, responseTime);
  }

  // ── Admin endpoints ───────────────────────────────────────────────────────

  @Get('all')
  getAllWords(
    @Query('language') language?: string,
    @Query('cefrLevel') cefrLevel?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wordsService.getAllWords({
      language,
      cefrLevel,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      search,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('stats-summary')
  getStats() {
    return this.wordsService.getWordStats();
  }

  // Bulk import
  @Post('import')
  bulkImport(@Body() body: { words: any[] }) {
    return this.wordsService.bulkImport(body.words);
  }

  // Update word
  @Patch(':id')
  updateWord(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.wordsService.updateWord(id, body);
  }

  // Toggle active
  @Patch(':id/active')
  toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.wordsService.toggleActive(id, isActive);
  }

  // Legacy CEFR update
  @Patch(':id/cefr')
  updateCefrLevel(
    @Param('id') id: string,
    @Body('cefrLevel') cefrLevel: string,
  ) {
    return this.wordsService.updateCefrLevel(Number(id), cefrLevel);
  }
}
