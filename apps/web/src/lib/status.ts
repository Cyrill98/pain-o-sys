import type { RequestStatus } from '@app/shared';

/** Badge style for each request status. */
export const statusVariant = (s: RequestStatus) =>
  s === 'new' ? 'pending' : s === 'lost' ? 'declined' : s === 'won' ? 'confirmed' : 'neutral';
