"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function main() {
    const jsonPath = path.resolve(process.cwd(), 'prisma', 'wordData', 'words.json');
    const words = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`${words.length} kelime import ediliyor...`);
    const BATCH = 500;
    for (let i = 0; i < words.length; i += BATCH) {
        const batch = words.slice(i, i + BATCH);
        await prisma.word.createMany({
            data: batch,
            skipDuplicates: true,
        });
        if ((i + BATCH) % 1000 === 0 || i + BATCH >= words.length) {
            console.log(`  ${Math.min(i + BATCH, words.length)} / ${words.length}`);
        }
    }
    const total = await prisma.word.count();
    console.log(`\n✓ Seed tamamlandı — DB'de toplam ${total} kelime`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
