import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  for (const lang of ['ENGLISH', 'SPANISH']) {
    const counts = await prisma.$queryRaw<any[]>`
      SELECT "cefrLevel", COUNT(*) as count
      FROM "Word"
      WHERE language = ${lang}::"Language" AND "isActive" = true
      GROUP BY "cefrLevel" ORDER BY "cefrLevel"
    `
    console.log(`${lang}:`, counts.map((r:any) => `${r.cefrLevel}:${r.count}`).join(', '))
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
