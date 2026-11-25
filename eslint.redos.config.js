// ReDoS lint (#367; owner, 2026-11-25, 80a/81a): only the rule
// redos/no-vulnerable of eslint-plugin-redos (recheck), over the same files
// as `eslint .`, in its own configuration so that `pnpm lint` keeps its
// speed. Run by `pnpm lint:redos` and the CI job „ReDoS lint“.
import { defineConfig } from 'eslint/config';
import redos from 'eslint-plugin-redos';
import tseslint from 'typescript-eslint';
import { ignores } from './eslint.config.js';

/**
 * The time recheck may spend on one expression, in milliseconds. The slowest
 * of the 850 checks of the tree of 2026-11-25 took 3.2 to 3.6 s in three
 * runs (4 cores, recheck's native binary); 30 s leave about eight times
 * that. A timeout is a finding (ignoreErrors: false), never a pass.
 */
const TIMEOUT = 30_000;

/** Options shared by production code and tests. */
const common = { ignoreErrors: false, timeout: TIMEOUT };

/** Tests and their helpers: only exponential patterns are findings. */
const TESTS = ['**/*.test.ts', 'e2e/**', 'src/test/**'];

export default defineConfig(
  { ignores },
  // The disable comments are for the rules of eslint.config.js.
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  // The TypeScript parser of eslint.config.js, without its rules.
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx'],
    extends: [tseslint.configs.base],
  },
  {
    plugins: { redos },
    // Production code and scripts: polynomial patterns are findings too.
    rules: { 'redos/no-vulnerable': ['error', common] },
  },
  {
    files: TESTS,
    rules: {
      'redos/no-vulnerable': [
        'error',
        { ...common, permittableComplexities: ['polynomial'] },
      ],
    },
  },
);
