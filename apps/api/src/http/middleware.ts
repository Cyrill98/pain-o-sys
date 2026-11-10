import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { sendError } from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowedOrigin = new URL(config.SITE_URL).origin;

/**
 * CSRF protection: state-changing requests must come from our own site.
 * Browsers always send Origin on cross-origin and same-origin POST/PUT/PATCH/DELETE fetches.
 */
export const requireSameOrigin: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('origin') !== allowedOrigin) return sendError(res, 403, 'BAD_ORIGIN');
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.adminId) return sendError(res, 401, 'UNAUTHENTICATED');
  next();
};
