import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient({ log: ['error'] });

try {
  const evs = await prisma.evidence.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
  console.log(`Found ${evs.length} evidence records`);

  for (const e of evs) {
    const relativePath = e.filePath.startsWith("/") ? e.filePath.slice(1) : e.filePath;
    const filePath = path.resolve(__dirname, relativePath);
    const diskExists = fs.existsSync(filePath);
    console.log(JSON.stringify({ 
      id: e.id, 
      fileName: e.fileName, 
      filePath: e.filePath, 
      resolved: filePath,
      exists: diskExists,
      fileType: e.fileType
    }));
  }
} catch (err) {
  console.error("Error:", err.message);
}

await prisma.$disconnect();
