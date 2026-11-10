import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/** "012-345 6789" / "+60 12 345 6789" → "+60123456789"; null if not a valid number. */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), 'MY');
  return parsed?.isValid() ? parsed.number : null;
}
