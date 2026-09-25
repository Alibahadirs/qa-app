import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (resource: string, id: string) =>
  new HttpError(404, `${resource} bulunamadı: ${id}`);

/** Async route handler'ların reject'lerini Express error middleware'ine aktarır. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Geçersiz istek',
      details: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  // express.json() ayrıştırma hataları istemci hatasıdır, 500 değil.
  if (typeof err === 'object' && err !== null && 'type' in err) {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'İstek gövdesi geçerli JSON değil.' });
      return;
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'İstek gövdesi çok büyük.' });
      return;
    }
  }

  // Prisma "kayıt bulunamadı" hatası
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
    res.status(404).json({ error: 'Kayıt bulunamadı' });
    return;
  }

  console.error('[backend] beklenmeyen hata:', err);
  res.status(500).json({ error: 'Sunucu hatası' });
}
