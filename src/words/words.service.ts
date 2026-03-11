import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WordsService {
  constructor(private prisma: PrismaService) {}

  async getWords(language: string, tier: string, cefrLevel?: string) {
    return this.prisma.word.findMany({
      where: {
        language: language as any,
        tier: tier as any,
        ...(cefrLevel ? { cefrLevel } : {}),
      },
      select: {
        id: true,
        word: true,
        translation: true,
        category: true,
        cefrLevel: true,
      },
    })
  }
}