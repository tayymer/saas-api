import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const words = [
    // Tier A - İngilizce temel kelimeler
    { word: 'cat', translation: 'kedi', language: 'ENGLISH', tier: 'A', category: 'animals' },
    { word: 'dog', translation: 'köpek', language: 'ENGLISH', tier: 'A', category: 'animals' },
    { word: 'bird', translation: 'kuş', language: 'ENGLISH', tier: 'A', category: 'animals' },
    { word: 'fish', translation: 'balık', language: 'ENGLISH', tier: 'A', category: 'animals' },
    { word: 'horse', translation: 'at', language: 'ENGLISH', tier: 'A', category: 'animals' },
    { word: 'red', translation: 'kırmızı', language: 'ENGLISH', tier: 'A', category: 'colors' },
    { word: 'blue', translation: 'mavi', language: 'ENGLISH', tier: 'A', category: 'colors' },
    { word: 'green', translation: 'yeşil', language: 'ENGLISH', tier: 'A', category: 'colors' },
    { word: 'yellow', translation: 'sarı', language: 'ENGLISH', tier: 'A', category: 'colors' },
    { word: 'black', translation: 'siyah', language: 'ENGLISH', tier: 'A', category: 'colors' },
    { word: 'one', translation: 'bir', language: 'ENGLISH', tier: 'A', category: 'numbers' },
    { word: 'two', translation: 'iki', language: 'ENGLISH', tier: 'A', category: 'numbers' },
    { word: 'three', translation: 'üç', language: 'ENGLISH', tier: 'A', category: 'numbers' },
    { word: 'four', translation: 'dört', language: 'ENGLISH', tier: 'A', category: 'numbers' },
    { word: 'five', translation: 'beş', language: 'ENGLISH', tier: 'A', category: 'numbers' },
    // Tier A - İspanyolca temel kelimeler
    { word: 'gato', translation: 'kedi', language: 'SPANISH', tier: 'A', category: 'animals' },
    { word: 'perro', translation: 'köpek', language: 'SPANISH', tier: 'A', category: 'animals' },
    { word: 'pájaro', translation: 'kuş', language: 'SPANISH', tier: 'A', category: 'animals' },
    { word: 'rojo', translation: 'kırmızı', language: 'SPANISH', tier: 'A', category: 'colors' },
    { word: 'azul', translation: 'mavi', language: 'SPANISH', tier: 'A', category: 'colors' },
    { word: 'uno', translation: 'bir', language: 'SPANISH', tier: 'A', category: 'numbers' },
    { word: 'dos', translation: 'iki', language: 'SPANISH', tier: 'A', category: 'numbers' },
    { word: 'tres', translation: 'üç', language: 'SPANISH', tier: 'A', category: 'numbers' },
  ]

  for (const word of words) {
    await prisma.word.upsert({
      where: { language_word: { language: word.language as any, word: word.word } },
      update: {},
      create: word as any,
    })
  }

  console.log('Seed tamamlandi!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())