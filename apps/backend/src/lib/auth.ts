import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errors.js';

const COOKIE = 'qa_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Parola tanımlı değilse auth tamamen kapalıdır (yerel geliştirme kolaylığı). */
export const authEnabled = (): boolean => Boolean(process.env.AUTH_PASSWORD);

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // Geliştirmede secret zorunlu olmasın; süreç yeniden başlayınca oturumlar düşer.
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  console.warn('[auth] SESSION_SECRET tanımlı değil, geçici bir anahtar üretildi.');
  return process.env.SESSION_SECRET;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createToken(): string {
  const payload = Buffer.from(String(Date.now() + MAX_AGE_MS)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  if (!safeEqual(mac, sign(payload))) return false;

  const expiry = Number(Buffer.from(payload, 'base64url').toString());
  return Number.isFinite(expiry) && expiry > Date.now();
}

/** Cookie başlığını ayrıştırır — tek bir cookie için ek paket gerekmiyor. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export const isAuthenticated = (req: Request): boolean =>
  !authEnabled() || isValidToken(readCookie(req, COOKIE));

export function setSessionCookie(res: Response): void {
  res.cookie(COOKIE, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(COOKIE, { path: '/' });
};

/** Parolayı sabit zamanlı karşılaştırır. */
export function checkPassword(input: unknown): boolean {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected) return false;
  if (typeof input !== 'string') return false;
  return safeEqual(input, expected);
}

const PUBLIC_PREFIXES = ['/health', '/auth'];

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (PUBLIC_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    next();
    return;
  }
  if (isAuthenticated(req)) {
    next();
    return;
  }
  next(new HttpError(401, 'Oturum açmanız gerekiyor.'));
}
