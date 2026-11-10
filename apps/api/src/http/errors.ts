import type { Response } from 'express';
import type { ApiError, ApiErrorCode } from '@app/shared';

/** Send a JSON error. Codes come from API_ERROR_CODES so the frontend can translate them. */
export function sendError(res: Response, status: number, code: ApiErrorCode) {
  const body: ApiError = { error: { code } };
  return res.status(status).json(body);
}
