import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import type { HealthResponse } from '@app/shared';
import { config } from './config.js';
import { sessionMiddleware } from './auth/session.js';
import { sendError } from './http/errors.js';
import { requireAdmin, requireSameOrigin } from './http/middleware.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';

export function createApp() {
  const app = express();

  // Behind Railway/Render's proxy: needed for Secure cookies and real client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const TURNSTILE = 'https://challenges.cloudflare.com';
  app.use(
    helmet({
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // 'wasm-unsafe-eval': lets the browser compile WebAssembly (the wall-selection model).
          scriptSrc: ["'self'", "'wasm-unsafe-eval'", TURNSTILE],
          frameSrc: [TURNSTILE],
          // The service worker fetches (and caches) Google Fonts.
          connectSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
          workerSrc: ["'self'", 'blob:'],
          manifestSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(requireSameOrigin);
  api.use(sessionMiddleware);

  api.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true, time: new Date().toISOString() };
    res.json(body);
  });
  api.use('/', publicRouter);
  api.use('/auth', authRouter);
  api.use('/admin', requireAdmin, adminRouter);

  api.use((_req, res) => sendError(res, 404, 'NOT_FOUND'));

  app.use('/api', api);

  // Production: serve the built PWA, falling back to index.html for client-side routes.
  if (config.isProd && fs.existsSync(config.webDistDir)) {
    app.use(express.static(config.webDistDir, { index: false }));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(config.webDistDir, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return sendError(res, 400, 'INVALID_JSON');
    if (err?.type === 'entity.too.large') return sendError(res, 413, 'TOO_LARGE');
    console.error(err);
    sendError(res, 500, 'INTERNAL_ERROR');
  };
  app.use(errorHandler);

  return app;
}
