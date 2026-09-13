import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * .env yükleyici. ESM modülleri import sırasına göre değerlendirdiği için bu modül,
 * process.env okuyan her modülden (db.ts, index.ts) ÖNCE import edilmelidir.
 * Prisma 7 artık .env'i otomatik yüklemiyor; Node 22'nin yerleşik yükleyicisi yeterli.
 */
const envPath = resolve(import.meta.dirname, '../.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
