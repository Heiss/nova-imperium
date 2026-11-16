// Fails when a change removes or edits a migration of its base commit or of
// the last release, changes the ID of one, or adds one with an ID older than
// the newest migration of the last release (#213, owner, 2026-11-16). With
// --hotfix it fails on any new migration: a hotfix brings no migration
// (O19). The migrations of the change are read from the working tree with
// the loader of the server, which also refuses stray files and an ID used
// twice; those of a commit or tag in any of their layouts
// (scripts/migration-refs.ts).
//   node .github/scripts/migrations-gate.mjs <base> [<release tag>] [--hotfix]
//   node .github/scripts/migrations-gate.mjs --local
// The release defaults to the base. --local is the check of `pnpm check`:
// it compares with the part of the local origin/main this branch holds and
// the newest release tag in it, and only warns without origin/main (the CI
// job is binding).
import { migrationHistoryViolation } from '../../src/server/db/migration-history.ts';
import { MIGRATIONS } from '../../src/server/db/schema.ts';
import {
  FOLDER,
  mergeBase,
  migrationsAt,
  newestReleaseTag,
  refExists,
} from '../../scripts/migration-refs.ts';

function localRefs() {
  if (!refExists('origin/main')) {
    console.log(
      '::warning::No local origin/main: the migrations are not compared with main here; the CI job "Migrations append-only" does it.',
    );
    process.exit(0);
  }
  const base = mergeBase('HEAD', 'origin/main');
  return { base, tag: newestReleaseTag('HEAD') ?? base, name: 'main' };
}

function ciRefs(args) {
  const [base, tag = base] = args.filter((a) => a !== '--hotfix');
  if (!base)
    throw new Error(
      'Usage: migrations-gate.mjs <base> [<release tag>] [--hotfix] | --local',
    );
  return { base, tag, name: 'the base' };
}

const args = process.argv.slice(2);
const hotfix = args.includes('--hotfix');
const {
  base: commit,
  tag,
  name,
} = args.includes('--local') ? localRefs() : ciRefs(args);
const base = await migrationsAt(commit);
const release = await migrationsAt(tag);
const violation = migrationHistoryViolation(
  base,
  MIGRATIONS,
  release,
  hotfix,
  name,
);
if (violation) {
  console.log(`::error file=${FOLDER}::${violation}`);
  process.exit(1);
}
console.log(
  `${base.length} migration(s) of ${commit} and ${release.length} of the release ${tag} unchanged, ${MIGRATIONS.length - base.length} added.`,
);
