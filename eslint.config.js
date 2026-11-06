import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'okf/**',
      'coverage/**',
      'reports/**',
      '.stryker-tmp/**',
      'data/**',
      'src/test/legacy/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/client/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  // Quality gates, the same as in muffelblog (strict). Tests are excluded from
  // the length rule: a describe block is a list, not logic.
  {
    files: ['**/*.ts', '**/*.mjs', '**/*.js'],
    plugins: { sonarjs },
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'sonarjs/cognitive-complexity': ['error', 10],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**'],
    rules: { 'max-lines-per-function': 'off' },
  },
  prettier,
);
