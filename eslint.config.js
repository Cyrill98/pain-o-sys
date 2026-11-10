import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      // AI-agent skill files (third-party), not app code
      '**/.agents/**',
      '**/.claude/**',
      // Downloaded model and runtime files (see apps/web/scripts/fetch-models.mjs)
      '**/public/ort/**',
      '**/public/models/**',
    ],
  },
  js.configs.recommended,
  { files: ['**/scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally unused args like Express's 4-arg error handler `_next`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // shadcn adds `import { cn } from 'cn'`; the themed one keeps colour classes intact.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'cn',
              message: "Import { cn } from '@/lib/utils' (it knows the Tenang theme).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/lib/utils.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // shadcn/ui components export variants alongside components
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  prettier,
);
