import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { loginRequestSchema, type LoginResponse, type MeResponse } from '@app/shared';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { getDummyHash, verifyPassword } from '../auth/password.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { sendError } from '../http/errors.js';

export const authRouter = Router();

// 10 failed attempts per IP per 15 minutes. Successful logins don't count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  handler: (_req, res) => sendError(res, 429, 'TOO_MANY_ATTEMPTS'),
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT');
  const { email, password } = parsed.data;

  const admin = await db.query.adminUsers.findFirst({
    where: eq(schema.adminUsers.email, email.toLowerCase()),
  });
  const ok = await verifyPassword(admin?.passwordHash ?? (await getDummyHash()), password);
  if (!admin || !ok) return sendError(res, 401, 'INVALID_CREDENTIALS');

  // New session id on login (prevents session fixation).
  req.session.regenerate((err) => {
    if (err) return sendError(res, 500, 'INTERNAL_ERROR');
    req.session.adminId = admin.id;
    req.session.save((saveErr) => {
      if (saveErr) return sendError(res, 500, 'INTERNAL_ERROR');
      const body: LoginResponse = {
        admin: { id: admin.id, email: admin.email, name: admin.name },
      };
      res.json(body);
    });
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'strict',
    });
    res.status(204).end();
  });
});

const signedOut: MeResponse = { admin: null };

authRouter.get('/me', async (req, res) => {
  if (!req.session.adminId) return res.json(signedOut);
  const admin = await db.query.adminUsers.findFirst({
    where: eq(schema.adminUsers.id, req.session.adminId),
    columns: { id: true, email: true, name: true },
  });
  if (!admin) {
    // Account removed while signed in.
    return req.session.destroy(() => res.json(signedOut));
  }
  const body: MeResponse = { admin };
  res.json(body);
});
