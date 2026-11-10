import { config } from '../config.js';
import { deleteExpiredRequests } from '../services/requests.js';
import { deleteOrphanUploads } from '../services/uploads.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hourly housekeeping (single instance):
 * - delete photos that never made it into a request (after a day)
 * - delete requests, with their photos, older than RETENTION_DAYS (privacy notice promise)
 */
export function startJobs() {
  const run = async () => {
    try {
      const photos = await deleteOrphanUploads();
      if (photos > 0) console.log(`Deleted ${photos} unclaimed photo(s).`);
      const requests = await deleteExpiredRequests(config.RETENTION_DAYS);
      if (requests > 0) {
        console.log(`Deleted ${requests} request(s) older than ${config.RETENTION_DAYS} days.`);
      }
    } catch (err) {
      console.error('hourly job failed', err);
    }
  };
  void run();
  const timer = setInterval(() => void run(), HOUR_MS);
  timer.unref();
  return () => clearInterval(timer);
}
