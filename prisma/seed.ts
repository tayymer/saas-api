import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface WordEntry {
  word: string
  translation: string
  language: string
  cefrLevel: string
  tier: string
  category: string
  frequencyRank: number
  isActive: boolean
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'prisma', 'wordData', 'words.json')
  const words: WordEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  console.log(`${words.length} kelime import ediliyor...`)

  const BATCH = 500

  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH)
    await prisma.word.createMany({
      data: batch as any[],
      skipDuplicates: true,
    })
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= words.length) {
      console.log(`  ${Math.min(i + BATCH, words.length)} / ${words.length}`)
    }
  }

  const total = await prisma.word.count()
  console.log(`\n✓ Seed tamamlandı — DB'de toplam ${total} kelime`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
