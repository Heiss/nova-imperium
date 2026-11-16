// „Upgrade-Test Pflicht“ (owner, 2026-11-16, #213): every migration of an
// issue file has its upgrade test src/server/db/upgrades/<id>.test.ts, which
// imports its migration file statically (so Stryker relates the file to the
// test) and checks the migration on real data. The 20 legacy migrations
// keep their tests as they are.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  upgradeTestViolations,
  type MigrationFile,
} from '../../test/migrations.ts';
import type { Migration } from './migration-files.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ISSUE = /^[1-9]\d*$/;

/** The issue files of the migration folder and the IDs they define. */
async function issueFiles(): Promise<MigrationFile[]> {
  const folder = path.join(here, 'migrations');
  const issues = readdirSync(folder).filter((n) => ISSUE.test(n));
  return Promise.all(
    issues.map(async (issue) => {
      const file = path.join(folder, issue, 'migrations.ts');
      const list = (await import(file)) as { default: Migration[] };
      return { issue, ids: list.default.map((m) => m.id) };
    }),
  );
}

const readTest = (id: string): string | undefined => {
  const file = path.join(here, 'upgrades', `${id}.test.ts`);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

describe('upgrade tests of the migrations of the issues', () => {
  it('exist for every migration and import its file statically', async () => {
    expect(upgradeTestViolations(await issueFiles(), readTest)).toEqual([]);
  });
});

describe('the check of the upgrade tests', () => {
  const id = '20261116T1405-cargo';
  const files = [{ issue: '213', ids: [id] }];
  const check = (source: string | undefined): string[] =>
    upgradeTestViolations(files, () => source);
  const missing = `Migration ${id} of src/server/db/migrations/213/migrations.ts has no upgrade test: add src/server/db/upgrades/${id}.test.ts, which imports src/server/db/migrations/213/migrations.ts statically and checks the migration on real data (pnpm new-migration <issue> <short-name> --create writes such a test with a new migration).`;
  const noImport = `src/server/db/upgrades/${id}.test.ts does not import its migration file statically: add import migrations from '../migrations/213/migrations.ts'; at its top.`;

  it('refuses a migration without upgrade test', () => {
    expect(check(undefined)).toEqual([missing]);
  });

  it('accepts a static import of the migration file', () => {
    for (const line of [
      "import migrations from '../migrations/213/migrations.ts';",
      'import migrations from "../migrations/213/migrations.ts";',
      "import list, { type X } from '../migrations/213/migrations.ts';",
      "import {\n  default as m,\n} from '../migrations/213/migrations.ts';",
    ])
      expect(check(`import { it } from 'vitest';\n${line}\n`), line).toEqual(
        [],
      );
  });

  it('refuses a test that does not import its migration file statically', () => {
    for (const source of [
      "import { it } from 'vitest';\n",
      "const m = await import('../migrations/213/migrations.ts');\n",
      "import type { M } from '../migrations/213/migrations.ts';\n",
      "import migrations from '../migrations/2134/migrations.ts';\n",
      "import migrations from '../migrations/21/migrations.ts';\n",
      "import migrations from '../migrations/213/migrations.tsx';\n",
      "import migrations from '../migrations/213/migrationsXts';\n",
      "// import migrations from '../migrations/213/migrations.ts';\n",
    ])
      expect(check(source), source).toEqual([noImport]);
  });

  it('checks every migration of every file', () => {
    const two = [
      { issue: '213', ids: [id, '20261116T1406-more'] },
      { issue: '7', ids: ['20261116T1407-other'] },
    ];
    const tests: Record<string, string> = {
      [id]: "import m from '../migrations/213/migrations.ts';\n",
      '20261116T1407-other':
        "import m from '../migrations/213/migrations.ts';\n",
    };
    const violations = upgradeTestViolations(two, (t) => tests[t]);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatch(/^Migration 20261116T1406-more of /);
    expect(violations[1]).toBe(
      "src/server/db/upgrades/20261116T1407-other.test.ts does not import its migration file statically: add import migrations from '../migrations/7/migrations.ts'; at its top.",
    );
  });
});
