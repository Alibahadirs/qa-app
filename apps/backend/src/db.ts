import './env.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL tanımlı değil. apps/backend/.env dosyasını oluşturun.');
}

const adapter = new PrismaBetterSqlite3({ url });

export const prisma = new PrismaClient({ adapter });
