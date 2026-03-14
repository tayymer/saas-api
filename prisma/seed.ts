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
  const jsonPath = path.join(__dirname, 'wordData', 'words.json')
  const words: WordEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  console.log(`${words.length} kelime import ediliyor...`)

  let created = 0
  let updated = 0
  const BATCH = 100

  for (let i = 0; i < words.length; i += BATCH) {
    const batch = words.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (w) => {
        const existing = await prisma.word.findUnique({
          where: { language_word: { language: w.language as any, word: w.word } }
        })
        if (existing) {
          await prisma.word.update({
            where: { language_word: { language: w.language as any, word: w.word } },
            data: {
              translation: w.translation,
              cefrLevel: w.cefrLevel,
              tier: w.tier as any,
              category: w.category,
              frequencyRank: w.frequencyRank,
              isActive: w.isActive,
            }
          })
          updated++
        } else {
          await prisma.word.create({ data: w as any })
          created++
        }
      })
    )
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= words.length) {
      console.log(`  ${Math.min(i + BATCH, words.length)} / ${words.length}`)
    }
  }

  console.log(`\n✓ ${created} yeni kelime eklendi, ${updated} kelime güncellendi`)
  console.log(`✓ Toplam: ${words.length} kelime`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
