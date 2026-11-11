import { defineConfig } from 'vitest/config';

// The logic of the game is measured: the shared rules, the server and the
// logic of the browser client. Not counted, like the Astro templates in
// muffelblog: the HTML templates of the client, the SVG art, the browser glue
// and the thin process entry points. The E2E suite and the Compose job run them.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/**/*.ts',
        'src/server/**/*.ts',
        'src/client/logic/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        'src/server/main.ts',
        'src/server/cli.ts',
        // Runs in a worker thread; tested through maintenance.test.ts.
        'src/server/db/migrate-worker.ts',
        'src/server/test-helpers.ts',
        'src/test/**',
      ],
      thresholds: { lines: 90, branches: 85 },
      reporter: ['text-summary', 'json-summary', 'text'],
    },
  },
});
