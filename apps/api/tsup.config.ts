import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    migrate: 'src/db/migrate.ts',
    'create-admin': 'src/scripts/create-admin.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle the workspace package (it ships TypeScript source); keep npm deps external.
  noExternal: ['@app/shared'],
  // migrate.js looks for ./migrations next to itself.
  onSuccess: 'rm -rf dist/migrations && cp -R src/db/migrations dist/migrations',
});
