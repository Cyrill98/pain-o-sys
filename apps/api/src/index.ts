import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';
import { startJobs } from './jobs/index.js';

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
