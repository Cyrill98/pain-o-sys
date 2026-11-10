import { Router } from 'express';
import { z } from 'zod';
import {
  REQUEST_STATUSES,
  colorInputSchema,
  colorPatchSchema,
  colorsImportSchema,
  pushSubscribeSchema,
  requestPatchSchema,
  settingsPatchSchema,
  type Color,
} from '@app/shared';
import { sendError } from '../http/errors.js';
import {
  createColor,
  createColors,
  deleteColor,
  listColors,
  updateColor,
} from '../services/colors.js';
import { notify } from '../services/notify.js';
import { removeAdminSubscription, saveSubscription } from '../services/push.js';
import {
  countNew,
  deleteRequest,
  getRequest,
  listRequests,
  patchRequest,
} from '../services/requests.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { findUploadFile } from '../services/uploads.js';

/**
 * Admin-only API. Mounted behind `requireAdmin`, so every route here needs a signed-in admin.
 */
export const adminRouter = Router();

const idSchema = z.uuid();

adminRouter.get('/ping', (_req, res) => {
  res.json({ ok: true });
});

// ── Requests ─────────────────────────────────────────

adminRouter.get('/requests', async (req, res) => {
  const status = z.enum(REQUEST_STATUSES).optional().safeParse(req.query.status);
  if (!status.success) return sendError(res, 400, 'INVALID_INPUT');
  res.json({ requests: await listRequests(status.data) });
});

adminRouter.get('/requests/new-count', async (_req, res) => {
  res.json({ count: await countNew() });
});

adminRouter.get('/requests/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, 'NOT_FOUND');
  const request = await getRequest(id.data);
  if (!request) return sendError(res, 404, 'NOT_FOUND');
  res.json(request);
});

adminRouter.patch('/requests/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const patch = requestPatchSchema.safeParse(req.body);
  if (!id.success) return sendError(res, 404, 'NOT_FOUND');
  if (!patch.success) return sendError(res, 400, 'INVALID_INPUT');
  const request = await patchRequest(id.data, patch.data);
  if (!request) return sendError(res, 404, 'NOT_FOUND');
  res.json(request);
});

adminRouter.delete('/requests/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, 'NOT_FOUND');
  if (!(await deleteRequest(id.data))) return sendError(res, 404, 'NOT_FOUND');
  res.status(204).end();
});

// ── Photos (only the admin may view them) ────────────

adminRouter.get('/uploads/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, 'NOT_FOUND');
  const file = await findUploadFile(id.data);
  if (!file) return sendError(res, 404, 'NOT_FOUND');
  res.type(file.mime);
  res.set('Cache-Control', 'private, max-age=86400');
  res.sendFile(file.path, (err) => {
    if (err && !res.headersSent) sendError(res, 404, 'NOT_FOUND');
  });
});

// ── Color catalog ────────────────────────────────────

adminRouter.get('/colors', async (_req, res) => {
  const body: { colors: Color[] } = { colors: await listColors({ includeHidden: true }) };
  res.json(body);
});

adminRouter.post('/colors', async (req, res) => {
  const input = colorInputSchema.safeParse(req.body);
  if (!input.success) return sendError(res, 400, 'INVALID_INPUT');
  res.status(201).json(await createColor(input.data));
});

adminRouter.post('/colors/import', async (req, res) => {
  const input = colorsImportSchema.safeParse(req.body);
  if (!input.success) return sendError(res, 400, 'INVALID_INPUT');
  res.status(201).json({ imported: await createColors(input.data.colors) });
});

adminRouter.patch('/colors/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const patch = colorPatchSchema.safeParse(req.body);
  if (!id.success) return sendError(res, 404, 'NOT_FOUND');
  if (!patch.success) return sendError(res, 400, 'INVALID_INPUT');
  const color = await updateColor(id.data, patch.data);
  if (!color) return sendError(res, 404, 'NOT_FOUND');
  res.json(color);
});

adminRouter.delete('/colors/:id', async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, 'NOT_FOUND');
  if (!(await deleteColor(id.data))) return sendError(res, 404, 'NOT_FOUND');
  res.status(204).end();
});

// ── Settings ─────────────────────────────────────────

adminRouter.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

adminRouter.patch('/settings', async (req, res) => {
  const patch = settingsPatchSchema.safeParse(req.body);
  if (!patch.success) {
    const invalidPhone = patch.error.issues.some((i) => i.message === 'INVALID_PHONE');
    return sendError(res, 400, invalidPhone ? 'INVALID_PHONE' : 'INVALID_INPUT');
  }
  res.json(await updateSettings(patch.data));
});

// ── Push notifications (admin devices) ───────────────

adminRouter.post('/push', async (req, res) => {
  const body = pushSubscribeSchema.safeParse(req.body);
  if (!body.success) return sendError(res, 400, 'INVALID_INPUT');
  await saveSubscription(req.session.adminId!, body.data.subscription, body.data.lang);
  res.status(204).end();
});

adminRouter.delete('/push', async (req, res) => {
  const endpoint = z.url().max(1000).safeParse(req.body?.endpoint);
  if (!endpoint.success) return sendError(res, 400, 'INVALID_INPUT');
  await removeAdminSubscription(req.session.adminId!, endpoint.data);
  res.status(204).end();
});

adminRouter.post('/push/test', async (_req, res) => {
  const sent = await notify.test();
  res.json({ sent });
});
