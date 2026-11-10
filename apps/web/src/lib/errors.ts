import { useTranslation } from 'react-i18next';
import { API_ERROR_CODES, CLIENT_ERROR_CODES, type ErrorCode } from '@app/shared';
import { ApiRequestError } from './api';

const KNOWN_CODES = new Set<string>([...API_ERROR_CODES, ...CLIENT_ERROR_CODES]);

export function errorCodeOf(error: unknown): ErrorCode {
  if (error instanceof ApiRequestError && KNOWN_CODES.has(error.code)) {
    return error.code as ErrorCode;
  }
  return 'UNKNOWN';
}

/** Translated, user-friendly message for any error thrown by apiFetch. */
export function useErrorMessage() {
  const { t } = useTranslation('errors');
  return (error: unknown) => t(errorCodeOf(error));
}
