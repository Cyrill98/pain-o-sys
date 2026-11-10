import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  createRequestSchema,
  openedSchema,
  type Color,
} from '@app/shared';
import { config } from '../config.js';
import { sendError } from '../http/errors.js';
import { listColors } from '../services/colors.js';
import { notify } from '../services/notify.js';
import { publicVapidKey } from '../services/push.js';
import {
  RequestError,
  createRequest,
  getRequest,
  markWhatsappOpened,
} from '../services/requests.js';
import { getPublicSettings } from '../services/settings.js';
import { verifyTurnstile } from '../services/turnstile.js';
import { saveUpload } from '../services/uploads.js';

export const publicRouter = Router();

const limiter = (windowMin: number, limit: number) =>
  rateLimit({
    windowMs: windowMin * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.NODE_ENV === 'test',
    handler: (_req, res) => sendError(res, 429, 'TOO_MANY_REQUESTS'),
  });

publicRouter.get('/settings/public', async (_req, res) => {
  res.json(await getPublicSettings());
});

/** The palette guests choose from (visible colors only). */
publicRouter.get('/colors', async (_req, res) => {
  const body: { colors: Color[] } = { colors: await listColors({ includeHidden: false }) };
  res.json(body);
});

/**
 * A guest's photo (the original, or the recolored preview). Raw image body; the real type is
 * detected from the bytes. Returns an id to reference in POST /requests.
 */
publicRouter.post(
  '/uploads',
  limiter(60, 60),
  express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return sendError(res, 400, 'INVALID_IMAGE');
    }
    const id = await saveUpload(req.body);
    if (!id) return sendError(res, 400, 'INVALID_IMAGE');
    res.status(201).json({ id });
  },
);

publicRouter.post('/requests', limiter(60, 10), async (req, res) => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'INVALID_INPUT');

  if (!(await verifyTurnstile(parsed.data.turnstileToken, req.ip))) {
    return sendError(res, 400, 'CAPTCHA_FAILED');
  }

  try {
    const { id, ...body } = await createRequest(parsed.data, req.ip);
    res.status(201).json({ id, ...body });
    void getRequest(id).then((r) => r && notify.newRequest(r));
  } catch (err) {
    if (err instanceof RequestError) return sendError(res, err.status, err.code);
    throw err;
  }
});

const idSchema = z.uuid();

publicRouter.post('/requests/:id/opened', limiter(1, 30), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const body = openedSchema.safeParse(req.body);
  if (!id.success || !body.success) return sendError(res, 404, 'NOT_FOUND');
  try {
    await markWhatsappOpened(id.data, body.data.token);
    res.status(204).end();
  } catch (err) {
    if (err instanceof RequestError) return sendError(res, err.status, err.code);
    throw err;
  }
});

publicRouter.get('/push/public-key', (_req, res) => {
  res.json({ publicKey: publicVapidKey() });
});
