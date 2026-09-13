import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import multer from 'multer';
import { HttpError } from './errors.js';

export const UPLOAD_DIR = resolve(import.meta.dirname, '../../uploads');
export const UPLOAD_ROUTE = '/uploads';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

/** Dosya adı: <runId>-<caseId>-<rastgele>.<uzantı>; kullanıcı girdisi ada karışmaz. */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (v: unknown) => String(v ?? 'x').replace(/[^A-Za-z0-9_-]/g, '');
    const ext = extname(file.originalname).toLowerCase().slice(0, 8) || '.png';
    const id = randomBytes(6).toString('hex');
    cb(null, `${safe(req.params.id)}-${safe(req.params.caseId)}-${id}${ext}`);
  },
});

export const screenshotUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new HttpError(400, `Desteklenmeyen dosya türü: ${file.mimetype}. PNG, JPEG veya WebP yükleyin.`));
      return;
    }
    cb(null, true);
  },
}).single('screenshot');

/** multer'ın kendi hatalarını HttpError'a çevirir. */
export function toUploadError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new HttpError(400, 'Dosya çok büyük. En fazla 5 MB.');
    }
    return new HttpError(400, `Yükleme hatası: ${err.message}`);
  }
  return new HttpError(500, 'Yükleme sırasında beklenmeyen hata');
}
