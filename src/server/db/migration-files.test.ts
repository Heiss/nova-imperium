// The loader of the migration folder (owner, 2026-11-16, #213): legacy files
// and one migrations.ts per issue, sorted by ID; stray files and an ID used
// twice are refused.
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadMigrations } from './migration-files.ts';
import { MIGRATIONS } from './schema.ts';

// Every case gets its own folder: a module, once imported, stays cached
// under its path.
let dir: string;
const dirs: string[] = [];
const fresh = (): void => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-migration-files-'));
  dirs.push(dir);
};
beforeEach(fresh);
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const write = (file: string, text: string): void => {
  const target = path.join(dir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
};

const legacy = (id: string, number: number, sql = `-- ${id}`): void =>
  write(
    `legacy/${id}.ts`,
    `export const id = '${id}';\nexport const number = ${number};\nexport const sql = '${sql}';\n`,
  );

const issue = (n: string, ids: string[]): void =>
  write(
    `${n}/migrations.ts`,
    `import type { Migration } from '../../x.ts';\nconst list: Migration[] = ${JSON.stringify(ids.map((id) => ({ id, sql: `-- ${id}` })))};\nexport default list;\n`,
  );

/** The message the loader refuses with (an Error), or 'loaded'. */
async function refusal(dir: string): Promise<string> {
  try {
    await loadMigrations(dir);
    return 'loaded';
  } catch (error) {
    return (error as Error).message;
  }
}

const STRAY =
  'in the migrations folder: it holds legacy/<id>.ts and <issue number>/migrations.ts only.';

describe('the migration folder', () => {
  it('holds the 20 legacy migrations of the server', () => {
    expect(MIGRATIONS.filter((m) => m.number !== undefined)).toHaveLength(20);
  });

  // Each legacy file read on its own (a module instance of its own) is the
  // migration the server loaded: its ID is its file name.
  it('gives each legacy file as it is written', async () => {
    const legacyDir = fileURLToPath(
      new URL('migrations/legacy', import.meta.url),
    );
    const names = readdirSync(legacyDir);
    expect(names).toHaveLength(20);
    for (const name of names) {
      const file = (await import(`${path.join(legacyDir, name)}?alone`)) as {
        id: string;
        number: number;
        sql: string;
      };
      expect(`${file.id}.ts`).toBe(name);
      expect(MIGRATIONS.find((m) => m.id === file.id)).toEqual({
        id: file.id,
        number: file.number,
        sql: file.sql,
      });
    }
  });

  it('gives every migration in the order of the IDs, whatever its folder', async () => {
    legacy('20261101T0800-a', 1);
    legacy('20261103T0800-c', 2);
    issue('213', ['20261104T0800-d', '20261102T0800-b']);
    issue('7', ['20261101T0900-e']);
    expect(await loadMigrations(dir)).toEqual([
      { id: '20261101T0800-a', number: 1, sql: '-- 20261101T0800-a' },
      { id: '20261101T0900-e', sql: '-- 20261101T0900-e' },
      { id: '20261102T0800-b', sql: '-- 20261102T0800-b' },
      { id: '20261103T0800-c', number: 2, sql: '-- 20261103T0800-c' },
      { id: '20261104T0800-d', sql: '-- 20261104T0800-d' },
    ]);
  });

  it('takes only id and sql from the file of an issue', async () => {
    write(
      '5/migrations.ts',
      `export default [{ id: '20261101T0800-a', sql: 'x', number: 1, other: 2 }];\n`,
    );
    expect(await loadMigrations(dir)).toEqual([
      { id: '20261101T0800-a', sql: 'x' },
    ]);
  });

  it('is empty without migrations', async () => {
    expect(await loadMigrations(dir)).toEqual([]);
  });

  it('refuses an ID used twice and names both files', async () => {
    legacy('20261101T0800-a', 1);
    issue('9', ['20261101T0800-a']);
    expect(await refusal(dir)).toBe(
      'Migration 20261101T0800-a is defined twice, in 9/migrations.ts and in legacy/20261101T0800-a.ts.',
    );
  });

  it('refuses an ID used twice in one file', async () => {
    issue('9', ['20261101T0800-a', '20261101T0800-a']);
    expect(await refusal(dir)).toBe(
      'Migration 20261101T0800-a is defined twice, in 9/migrations.ts and in 9/migrations.ts.',
    );
  });

  it('refuses stray files and folders', async () => {
    const cases: [string, string][] = [
      ['README.md', 'README.md'],
      ['legacy/notes.md', 'legacy/notes.md'],
      ['213/README.md', '213/README.md'],
      ['213/upgrade.test.ts', '213/upgrade.test.ts'],
      ['0/migrations.ts', '0'],
      ['012/migrations.ts', '012'],
      ['12a/migrations.ts', '12a'],
      ['a12/migrations.ts', 'a12'],
      ['issue-5/migrations.ts', 'issue-5'],
      // Files at the top, even with the name of a folder.
      ['legacy', 'legacy'],
      ['214', '214'],
    ];
    for (const [file, named] of cases) {
      fresh();
      issue('213', ['20261101T0800-a']);
      write(file, 'export default [];\n');
      expect(await refusal(dir), file).toBe(`Stray file ${named} ${STRAY}`);
    }
  });

  it('accepts issue numbers of any length', async () => {
    issue('1', ['20261101T0800-a']);
    issue('1234', ['20261101T0900-b']);
    expect(await loadMigrations(dir)).toHaveLength(2);
  });

  it('refuses a legacy file without its ID, number or SQL', async () => {
    const message = (file: string): string =>
      `legacy/${file} must export its ID (the file name), its number and its SQL.`;
    const cases = [
      `export const id = '20261101T0800-b';\nexport const number = 1;\nexport const sql = 'x';\n`,
      `export const id = '20261101T0800-a';\nexport const sql = 'x';\n`,
      `export const id = '20261101T0800-a';\nexport const number = 1.5;\nexport const sql = 'x';\n`,
      `export const id = '20261101T0800-a';\nexport const number = 1;\n`,
    ];
    for (const text of cases) {
      fresh();
      write('legacy/20261101T0800-a.ts', text);
      expect(await refusal(dir), text).toBe(message('20261101T0800-a.ts'));
    }
  });

  it('refuses a file of an issue that is no list of migrations', async () => {
    const cases = [
      `export default [];\n`,
      `export default { id: '20261101T0800-a', sql: 'x' };\n`,
      `export default [null];\n`,
      `export default [{ id: '20261101T0800-a' }];\n`,
      `export default [{ sql: 'x' }];\n`,
      `export default [{ id: '20261101T0800-a', sql: 'x' }, { id: '20261101T0900-b' }];\n`,
      `export const migrations = [{ id: '20261101T0800-a', sql: 'x' }];\n`,
    ];
    for (const text of cases) {
      fresh();
      write('5/migrations.ts', text);
      expect(await refusal(dir), text).toBe(
        '5/migrations.ts must export a list of migrations: export default [{ id, sql }].',
      );
    }
  });

  it('refuses an invalid ID', async () => {
    issue('5', ['20261101T0800-a', '2026-11-01-b']);
    expect(await refusal(dir)).toMatch(
      /^Migration 1: "2026-11-01-b" is no migration ID/,
    );
  });
});
