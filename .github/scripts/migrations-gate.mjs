// Fails when a change moves, removes or edits a migration of its base commit.
//   node .github/scripts/migrations-gate.mjs <base commit>
// The base version of the schema file is read with git and imported from a
// temporary folder; the comparison is migrationHistoryViolation.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrationHistoryViolation } from '../../src/server/db/migration-history.ts';

const SCHEMA = 'src/server/db/schema.ts';

async function load(file) {
  const { MIGRATIONS } = await import(pathToFileURL(file).href);
  if (
    !Array.isArray(MIGRATIONS) ||
    MIGRATIONS.some((m) => typeof m !== 'string')
  )
    throw new Error(`${file} does not export MIGRATIONS as a list of strings.`);
  return MIGRATIONS;
}

async function loadBase(commit) {
  const source = execFileSync('git', ['show', `${commit}:${SCHEMA}`], {
    encoding: 'utf8',
  });
  const dir = mkdtempSync(path.join(tmpdir(), 'nova-migrations-'));
  try {
    writeFileSync(path.join(dir, 'schema.ts'), source);
    return await load(path.join(dir, 'schema.ts'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const commit = process.argv[2];
if (!commit) throw new Error('Usage: migrations-gate.mjs <base commit>');
const base = await loadBase(commit);
const head = await load(path.resolve(SCHEMA));
const violation = migrationHistoryViolation(base, head);
if (violation) {
  console.log(`::error file=${SCHEMA}::${violation}`);
  process.exit(1);
}
console.log(
  `${base.length} migration(s) of ${commit} unchanged, ${head.length - base.length} added.`,
);
