import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WordsService {
  constructor(private prisma: PrismaService) {}

  async getWords(language: string, tier: string) {
    return this.prisma.word.findMany({
      where: {
        language: language as any,
        tier: tier as any,
      },
      select: {
        id: true,
        word: true,
        translation: true,
        category: true,
      },
    })
  }
}