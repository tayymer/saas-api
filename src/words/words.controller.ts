import { Controller, Get, Query } from '@nestjs/common';
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
}
