import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const words = [
    // Tier A - İngilizce A1 (çok temel, 1-4 harf veya çok yaygın)
    { word: 'cat',    translation: 'kedi',     language: 'ENGLISH', tier: 'A', category: 'animals', cefrLevel: 'A1' },
    { word: 'dog',    translation: 'köpek',    language: 'ENGLISH', tier: 'A', category: 'animals', cefrLevel: 'A1' },
    { word: 'bird',   translation: 'kuş',      language: 'ENGLISH', tier: 'A', category: 'animals', cefrLevel: 'A1' },
    { word: 'fish',   translation: 'balık',    language: 'ENGLISH', tier: 'A', category: 'animals', cefrLevel: 'A1' },
    { word: 'red',    translation: 'kırmızı',  language: 'ENGLISH', tier: 'A', category: 'colors',  cefrLevel: 'A1' },
    { word: 'blue',   translation: 'mavi',     language: 'ENGLISH', tier: 'A', category: 'colors',  cefrLevel: 'A1' },
    { word: 'one',    translation: 'bir',      language: 'ENGLISH', tier: 'A', category: 'numbers', cefrLevel: 'A1' },
    { word: 'two',    translation: 'iki',      language: 'ENGLISH', tier: 'A', category: 'numbers', cefrLevel: 'A1' },
    { word: 'four',   translation: 'dört',     language: 'ENGLISH', tier: 'A', category: 'numbers', cefrLevel: 'A1' },
    { word: 'five',   translation: 'beş',      language: 'ENGLISH', tier: 'A', category: 'numbers', cefrLevel: 'A1' },
    // Tier A - İngilizce A2 (biraz daha uzun / az yaygın)
    { word: 'horse',  translation: 'at',       language: 'ENGLISH', tier: 'A', category: 'animals', cefrLevel: 'A2' },
    { word: 'green',  translation: 'yeşil',    language: 'ENGLISH', tier: 'A', category: 'colors',  cefrLevel: 'A2' },
    { word: 'yellow', translation: 'sarı',     language: 'ENGLISH', tier: 'A', category: 'colors',  cefrLevel: 'A2' },
    { word: 'black',  translation: 'siyah',    language: 'ENGLISH', tier: 'A', category: 'colors',  cefrLevel: 'A2' },
    { word: 'three',  translation: 'üç',       language: 'ENGLISH', tier: 'A', category: 'numbers', cefrLevel: 'A2' },
    // Tier A - İspanyolca A1
    { word: 'gato',   translation: 'kedi',     language: 'SPANISH', tier: 'A', category: 'animals', cefrLevel: 'A1' },
    { word: 'rojo',   translation: 'kırmızı',  language: 'SPANISH', tier: 'A', category: 'colors',  cefrLevel: 'A1' },
    { word: 'azul',   translation: 'mavi',     language: 'SPANISH', tier: 'A', category: 'colors',  cefrLevel: 'A1' },
    { word: 'uno',    translation: 'bir',      language: 'SPANISH', tier: 'A', category: 'numbers', cefrLevel: 'A1' },
    { word: 'dos',    translation: 'iki',      language: 'SPANISH', tier: 'A', category: 'numbers', cefrLevel: 'A1' },
    // Tier A - İspanyolca A2
    { word: 'perro',  translation: 'köpek',    language: 'SPANISH', tier: 'A', category: 'animals', cefrLevel: 'A2' },
    { word: 'pájaro', translation: 'kuş',      language: 'SPANISH', tier: 'A', category: 'animals', cefrLevel: 'A2' },
    { word: 'tres',   translation: 'üç',       language: 'SPANISH', tier: 'A', category: 'numbers', cefrLevel: 'A2' },
  ]

  for (const word of words) {
    await prisma.word.upsert({
      where: { language_word: { language: word.language as any, word: word.word } },
      update: { cefrLevel: word.cefrLevel },
      create: word as any,
    })
  }

  console.log('Seed tamamlandi!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())