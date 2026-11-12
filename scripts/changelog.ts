// Changelog fragments and the release pull request (owner, 2026-11-12):
// every player-visible pull request adds changes/<name>.md in German; the
// release pull request bundles them into CHANGELOG.md and VERSION; its merge
// tags the release. See okf/ops/branching-release.md.
//
//   node scripts/changelog.ts check <base-sha>      fragments valid, and one
//        present when the pull request changes the game (CI)
//   node scripts/changelog.ts next-version           CalVer of the next release
//   node scripts/changelog.ts release <version>      write CHANGELOG.md and
//        VERSION, remove the fragments, print the section
//   node scripts/changelog.ts notes <version>        the section of a release
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const KINDS = ['neu', 'geändert', 'behoben'] as const;
export type Kind = (typeof KINDS)[number];
const HEADINGS: Record<Kind, string> = {
  neu: 'Neu',
  geändert: 'Geändert',
  behoben: 'Behoben',
};
export const MAX_TEXT = 300;
const DIR = 'changes';
const CHANGELOG = 'CHANGELOG.md';
const VERSION = 'VERSION';
export const SKIP_LABEL = 'kein-changelog';
/** Paths whose changes players can notice; they need a fragment. */
const PLAYER_PATHS = ['src/client/', 'src/shared/', 'src/server/game/'];
const TITLE = '# Neuigkeiten';

export interface Fragment {
  name: string;
  kind: Kind;
  text: string;
}

/** Reads one fragment; throws with the reason when it is malformed. */
export function parseFragment(name: string, content: string): Fragment {
  const m = /^---\n(?<head>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/.exec(
    content.replace(/\r\n/g, '\n'),
  );
  if (!m?.groups) throw new Error(`${name}: front matter "---" is missing`);
  const kind = /^art:\s*(\S+)\s*$/m.exec(m.groups.head!)?.[1];
  if (!KINDS.includes(kind as Kind))
    throw new Error(`${name}: "art" must be one of ${KINDS.join(', ')}`);
  const text = m.groups.body!.trim().replace(/\s*\n\s*/g, ' ');
  if (!text) throw new Error(`${name}: the text is empty`);
  if (text.length > MAX_TEXT)
    throw new Error(`${name}: the text has more than ${MAX_TEXT} characters`);
  if (/^#/.test(text)) throw new Error(`${name}: no headings, one entry only`);
  return { name, kind: kind as Kind, text };
}

/** New first, then changed, then fixed; within a kind by file name. */
export function ordered(fragments: readonly Fragment[]): Fragment[] {
  return [...fragments].sort(
    (a, b) =>
      KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
      a.name.localeCompare(b.name),
  );
}

export function section(
  version: string,
  date: string,
  fragments: readonly Fragment[],
): string {
  const lines = [`## Version ${version} – ${date}`];
  for (const kind of KINDS) {
    const items = ordered(fragments).filter((f) => f.kind === kind);
    if (!items.length) continue;
    lines.push('', `### ${HEADINGS[kind]}`, '');
    for (const f of items) lines.push(`- ${f.text}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Puts the newest section right below the title. */
export function prepend(changelog: string, newSection: string): string {
  const body = changelog.startsWith(TITLE)
    ? changelog.slice(TITLE.length).replace(/^\n+/, '')
    : changelog;
  return `${TITLE}\n\n${newSection}${body ? `\n${body}` : ''}`;
}

/** The section of one version, or null. */
export function sectionOf(changelog: string, version: string): string | null {
  const start = changelog.indexOf(`## Version ${version} – `);
  if (start < 0) return null;
  const next = changelog.indexOf('\n## ', start + 1);
  return (
    changelog.slice(start, next < 0 ? undefined : next + 1).trimEnd() + '\n'
  );
}

/**
 * CalVer YY.M.MICRO in Europe/Berlin: the first release of a month is .0,
 * every further one counts up.
 */
export function nextVersion(tags: readonly string[], now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: '2-digit',
    month: 'numeric',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const yy = part('year');
  const mm = part('month');
  const prefix = `${yy}.${Number(mm)}.`;
  const micros = tags
    .filter((t) => t.startsWith(prefix))
    .map((t) => t.slice(prefix.length))
    .filter((m) => /^(0|[1-9]\d*)$/.test(m))
    .map(Number);
  return `${prefix}${micros.length ? Math.max(...micros) + 1 : 0}`;
}

export const germanDate = (now: Date): string =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);

/** Why a pull request needs a fragment it does not have, or null. */
export function missingFragment(
  changed: readonly string[],
  labels: readonly string[],
): string | null {
  if (labels.includes(SKIP_LABEL)) return null;
  const game = changed.filter((f) => PLAYER_PATHS.some((p) => f.startsWith(p)));
  if (!game.length) return null;
  const fragment = changed.some(
    (f) => f.startsWith(`${DIR}/`) && f.endsWith('.md') && !isReadme(f),
  );
  return fragment
    ? null
    : `The game changes (${game.slice(0, 3).join(', ')}${game.length > 3 ? ', …' : ''}) need a fragment in ${DIR}/ (German, see ${DIR}/README.md), or the label "${SKIP_LABEL}".`;
}

const isReadme = (f: string): boolean =>
  path.basename(f).toLowerCase() === 'readme.md';

/** The file's text, or null when it does not exist (no check-then-read race). */
function readIfPresent(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

function fragmentFiles(): string[] {
  try {
    return readdirSync(DIR);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

function readFragments(): Fragment[] {
  return fragmentFiles()
    .filter((f) => f.endsWith('.md') && !isReadme(f))
    .map((f) => parseFragment(f, readFileSync(path.join(DIR, f), 'utf8')));
}

const git = (...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();

function check(base: string | undefined): number {
  if (!base) throw new Error('Usage: changelog.ts check <base-sha>');
  readFragments();
  const changed = git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean);
  const labels = (process.env.PR_LABELS ?? '').split(',').filter(Boolean);
  const reason = missingFragment(changed, labels);
  if (reason) {
    console.log(`::error::${reason}`);
    return 1;
  }
  console.log('Changelog fragments are fine.');
  return 0;
}

function release(version: string | undefined): number {
  if (!version || !/^\d{2}\.([1-9]|1[0-2])\.(0|[1-9]\d*)$/.test(version))
    throw new Error('Usage: changelog.ts release <YY.M.MICRO>');
  const fragments = readFragments();
  const old = readIfPresent(CHANGELOG) ?? TITLE;
  const part = fragments.length
    ? section(version, germanDate(new Date()), fragments)
    : '';
  if (part) writeFileSync(CHANGELOG, prepend(old, part));
  writeFileSync(VERSION, `${version}\n`);
  for (const f of fragments) rmSync(path.join(DIR, f.name));
  process.stdout.write(part);
  return 0;
}

function notes(version: string | undefined): number {
  const text = readIfPresent(CHANGELOG) ?? '';
  process.stdout.write(
    sectionOf(text, version ?? '') ??
      'Keine für Spieler sichtbaren Änderungen.\n',
  );
  return 0;
}

/**
 * Every tag, and the version in VERSION: a merged release pull request is
 * not tagged yet while its CI push run is still running.
 */
function usedVersions(): string[] {
  const tags = git('tag', '--list').split('\n').filter(Boolean);
  const current = readIfPresent(VERSION)?.trim() ?? '';
  return current ? [...tags, current] : tags;
}

function main(): number {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case 'check':
      return check(arg);
    case 'next-version':
      console.log(nextVersion(usedVersions(), new Date()));
      return 0;
    case 'release':
      return release(arg);
    case 'notes':
      return notes(arg);
    default:
      console.error(
        'Usage: changelog.ts check <base> | next-version | release <version> | notes <version>',
      );
      return 1;
  }
}

if (import.meta.main) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.log(`::error::${(e as Error).message}`);
    process.exitCode = 1;
  }
}
