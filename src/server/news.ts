// „Neuigkeiten“ for players (issue #81, owner 2026-11-12): the released
// CHANGELOG.md and VERSION are part of the image. The server reads both at
// the start, serves the sections to the browser and, after an update, sends
// every player one message with the first entries since the version that
// ran before (settings key "version"). See okf/features/changelog.md.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { addReport, type Ctx } from './game/context.ts';

type Kind = 'neu' | 'geändert' | 'behoben';

export interface NewsEntry {
  kind: Kind;
  text: string;
}

export interface NewsVersion {
  version: string;
  /** German date as written in CHANGELOG.md, e.g. „12.11.2026“. */
  date: string;
  entries: NewsEntry[];
}

export interface News {
  /** The running version, or null in development (no VERSION file). */
  version: string | null;
  versions: NewsVersion[];
}

/** How many entries the update message lists (owner, 2026-11-12: top 3). */
const TOP = 3;
const SETTING = 'version';

const HEADINGS: Record<string, Kind> = {
  Neu: 'neu',
  Geändert: 'geändert',
  Behoben: 'behoben',
};

const VERSION = /^(\d{2})\.([1-9]|1[0-2])\.(0|[1-9]\d{0,2})$/;

/** CalVer YY.M.MICRO as one integer that keeps the order, or null. */
export function versionNumber(version: string): number | null {
  const m = VERSION.exec(version);
  if (!m) return null;
  return Number(m[1]) * 100_000 + Number(m[2]) * 1000 + Number(m[3]);
}

interface Parse {
  versions: NewsVersion[];
  kind: Kind | null;
}

function parseLine(state: Parse, line: string): void {
  const head = /^## Version (\S+) – (\d{2}\.\d{2}\.\d{4})$/.exec(line);
  if (head) {
    state.versions.push({ version: head[1]!, date: head[2]!, entries: [] });
    state.kind = null;
    return;
  }
  const sub = /^### (.+)$/.exec(line);
  if (sub) {
    state.kind = HEADINGS[sub[1]!] ?? null;
    return;
  }
  const current = state.versions.at(-1);
  const text = line.startsWith('- ') ? line.slice(2).trim() : '';
  if (current && state.kind && text)
    current.entries.push({ kind: state.kind, text });
}

/** The sections of CHANGELOG.md as written by scripts/changelog.ts. */
export function parseChangelog(text: string): NewsVersion[] {
  const state: Parse = { versions: [], kind: null };
  for (const line of text.split(/\r?\n/)) parseLine(state, line.trim());
  return state.versions.filter((v) => versionNumber(v.version) !== null);
}

/** Reads CHANGELOG.md and VERSION from the app folder; both may be missing. */
export function loadNews(root: string): News {
  const read = (file: string): string => {
    try {
      return readFileSync(path.join(root, file), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return '';
      throw e;
    }
  };
  const version = read('VERSION').trim();
  return {
    version: versionNumber(version) === null ? null : version,
    versions: parseChangelog(read('CHANGELOG.md')),
  };
}

/** The entries of the versions after `before` up to `current`, newest first. */
export function entriesSince(
  versions: readonly NewsVersion[],
  before: number,
  current: number,
): NewsEntry[] {
  return versions
    .filter((v) => {
      const n = versionNumber(v.version)!;
      return n > before && n <= current;
    })
    .sort((a, b) => versionNumber(b.version)! - versionNumber(a.version)!)
    .flatMap((v) => v.entries);
}

/** The German update message, or null when there is nothing to tell. */
export function updateText(
  version: string,
  entries: readonly NewsEntry[],
): string | null {
  if (!entries.length) return null;
  const more = entries.length - TOP;
  return [
    `Nova Imperium wurde auf Version ${version} aktualisiert. Das ist neu:`,
    ...entries.slice(0, TOP).map((e) => `• ${e.text}`),
    more > 0
      ? `… und ${more} weitere Änderung${more === 1 ? '' : 'en'}. Alles steht unter „Neuigkeiten“.`
      : 'Alle Versionen stehen unter „Neuigkeiten“.',
  ].join('\n');
}

/**
 * Called once at every start. A newer version than the one stored sends
 * every player one message; the same or an older version (rollback) sends
 * none and is not stored. Without a stored version (the first start with
 * this feature) the message holds only the entries of the running version
 * (owner, 2026-11-12): a world with players hears about it once, a new
 * world has nobody to tell. Returns the number of players told.
 */
export function announceUpdate(ctx: Ctx, news: News): number {
  if (!news.version) return 0;
  const current = versionNumber(news.version)!;
  const row = ctx.store.db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTING) as { value: number } | undefined;
  // The highest version that ever ran: rolling back and forward again does
  // not repeat the message.
  if (row && row.value >= current) return 0;
  ctx.store.db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(SETTING, current);
  const text = updateText(
    news.version,
    entriesSince(news.versions, row ? row.value : current - 1, current),
  );
  if (!text) return 0;
  const players = ctx.store.users();
  const time = ctx.now();
  for (const player of players)
    addReport(
      ctx,
      player.id,
      {
        time,
        type: 'info',
        title: `Neu in Version ${news.version}`,
        text,
        // The browser shows the lines and a link to „Neuigkeiten“.
        news: news.version,
      },
      'messages',
      `Nova Imperium ${news.version} ist da.`,
    );
  return players.length;
}
