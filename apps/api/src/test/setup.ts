import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Photos go to a throwaway folder (must be set before src/config.ts is imported).
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'painting-test-uploads-'));
