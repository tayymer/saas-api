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

  async getAllWords() {
    return this.prisma.word.findMany({
      select: {
        id: true,
        word: true,
        translation: true,
        language: true,
        tier: true,
        category: true,
        cefrLevel: true,
      },
      orderBy: [{ tier: 'asc' }, { language: 'asc' }, { word: 'asc' }],
    })
  }

  async updateCefrLevel(id: number, cefrLevel: string) {
    return this.prisma.word.update({
      where: { id },
      data: { cefrLevel },
      select: { id: true, word: true, cefrLevel: true },
    })
  }
}