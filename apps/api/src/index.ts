import fs from 'node:fs';
import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';
import { startJobs } from './jobs/index.js';

// Photos need a writable folder. In production a missing or read-only disk is a setup mistake,
// so stop at startup with a clear message instead of failing on the first upload.
try {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  fs.accessSync(config.UPLOAD_DIR, fs.constants.W_OK);
} catch (err) {
  console.error(`UPLOAD_DIR (${config.UPLOAD_DIR}) is not writable:`, (err as Error).message);
  if (config.isProd) process.exit(1);
}

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

const stopJobs = startJobs();

// Graceful shutdown for redeploys.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopJobs();
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  });
}
