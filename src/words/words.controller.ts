import { Controller, Get, Query } from '@nestjs/common';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  getWords(
    @Query('language') language: string = 'ENGLISH',
    @Query('tier') tier: string = 'A',
  ) {
    return this.wordsService.getWords(language, tier);
  }
}