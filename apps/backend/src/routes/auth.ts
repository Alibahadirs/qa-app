import { Router } from 'express';
import { z } from 'zod';
import {
  authEnabled,
  checkPassword,
  clearSessionCookie,
  isAuthenticated,
  setSessionCookie,
} from '../lib/auth.js';
import { HttpError, asyncHandler } from '../lib/errors.js';

export const authRouter = Router();

const loginSchema = z.object({ password: z.string().min(1, 'Parola zorunlu') });

authRouter.get('/me', (req, res) => {
  res.json({ required: authEnabled(), authenticated: isAuthenticated(req) });
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    if (!authEnabled()) {
      res.json({ required: false, authenticated: true });
      return;
    }

    const { password } = loginSchema.parse(req.body);

    // Kaba kuvvet denemelerini yavaşlatmak için sabit gecikme.
    await new Promise((r) => setTimeout(r, 300));

    if (!checkPassword(password)) throw new HttpError(401, 'Parola hatalı.');

    setSessionCookie(res);
    res.json({ required: true, authenticated: true });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ required: authEnabled(), authenticated: false });
});
