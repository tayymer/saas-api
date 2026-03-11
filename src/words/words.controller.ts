import { Controller, Get, Patch, Query, Param, Body } from '@nestjs/common';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  getWords(
    @Query('language') language: string = 'ENGLISH',
    @Query('tier') tier: string = 'A',
    @Query('cefr_level') cefrLevel?: string,
  ) {
    return this.wordsService.getWords(language, tier, cefrLevel);
  }

  @Get('all')
  getAllWords() {
    return this.wordsService.getAllWords();
  }

  @Patch(':id/cefr')
  updateCefrLevel(
    @Param('id') id: string,
    @Body('cefrLevel') cefrLevel: string,
  ) {
    return this.wordsService.updateCefrLevel(Number(id), cefrLevel);
  }
}
