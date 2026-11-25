// The update log of the OKF bundle as one file per entry (owner, 2026-11-15,
// #212): every entry is okf/log/<date>-<short-name>.md (D1), okf/log.md is
// gone and the website builds the log page from the folder (D3), so two pull
// requests that each add an entry no longer conflict. See okf/ops/website.md.
//
//   ---
//   type: log-entry
//   date: 2026-11-15T00:30
//   kind: Code
//   issues: [163, 45]
//   ---
//
//   #163 built: …
//
// The date holds a UTC time from 2026-11-15 on, so a day lists its entries
// newest first; the entries before keep the date only (owner, 2026-11-15,
// O15).
//
//   node scripts/okf-log.ts check   every entry of okf/log well-formed (CI)
//
// The website (website/lib/log.mjs) renders the page with logMarkdown().
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The kinds of entry, exactly those okf/log.md used before the split. */
export const KINDS = [
  'Decision',
  'Decision and code',
  'Code',
  'Feature',
  'Fix',
  'Update',
  'Docs',
] as const;
export type Kind = (typeof KINDS)[number];

/** The `type` of every entry in the OKF front matter. */
const TYPE = 'log-entry';
/** D1: okf/log/<date>-<short-name>.md, the short name in kebab case. */
const NAME = /^(\d{4}-\d{2}-\d{2})-[a-z\d]+(?:-[a-z\d]+)*\.md$/;
/** YYYY-MM-DD, or YYYY-MM-DDTHH:MM with a UTC time. */
const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;
/** The first day whose entries need a time [V]. */
const TIME_FROM = '2026-11-15';
const ISSUES = /^\[\s*[1-9]\d*(?:\s*,\s*[1-9]\d*)*\s*\]$/;

export interface LogEntry {
  /** The file name, e.g. 2026-11-14-guild-ranks.md. */
  name: string;
  /** YYYY-MM-DD, the same as the start of the name. */
  date: string;
  /** HH:MM in UTC; the entries before 2026-11-15 have none. */
  time?: string;
  kind: Kind;
  /** The issues and pull requests the entry names, may be empty. */
  issues: number[];
  /** The text, joined to one line. */
  text: string;
}

function isDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const day = date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return day && Number(m[4] ?? 0) < 24 && Number(m[5] ?? 0) < 60;
}

/** The front matter as key → value; one "key: value" per line. */
function frontMatter(name: string, head: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of head.split('\n')) {
    const m = /^([a-z_]+):(?: (.*))?$/.exec(line);
    if (!m || m[2] === undefined)
      throw new Error(
        `${name}: every front matter line is "key: value", not "${line}"`,
      );
    if (fields.has(m[1]!)) throw new Error(`${name}: "${m[1]}" is given twice`);
    fields.set(m[1]!, m[2].trim());
  }
  return fields;
}

/**
 * The date and the time of the front matter: a valid date, the same day as
 * in the name, and a time from 2026-11-15 on.
 */
function entryDate(
  name: string,
  nameDate: string,
  value = '',
): { date: string; time?: string } {
  if (!isDate(value))
    throw new Error(
      `${name}: "date" must be a valid date YYYY-MM-DD or YYYY-MM-DDTHH:MM`,
    );
  const [date, time] = value.split('T') as [string, string?];
  if (date !== nameDate)
    throw new Error(
      `${name}: "date" ${value} differs from the date of the name`,
    );
  if (time === undefined && date >= TIME_FROM)
    throw new Error(
      `${name}: "date" needs a UTC time from ${TIME_FROM} on, like ${date}T00:30`,
    );
  return time === undefined ? { date } : { date, time };
}

/** The issue numbers of "[191, 118]"; none when the key is left out. */
function issueList(name: string, list?: string): number[] {
  if (list === undefined) return [];
  if (!ISSUES.test(list))
    throw new Error(`${name}: "issues" must be a list like [191, 118]`);
  return (list.match(/\d+/g) ?? []).map(Number);
}

/** The type, the description and the kind of the front matter. */
function checkKeys(name: string, fields: Map<string, string>): Kind {
  if (fields.get('type') !== TYPE)
    throw new Error(`${name}: "type" must be ${TYPE}`);
  if (fields.get('description')?.includes(': '))
    throw new Error(`${name}: "description" must not contain ": "`);
  const kind = fields.get('kind') as Kind;
  if (!KINDS.includes(kind))
    throw new Error(`${name}: "kind" must be one of ${KINDS.join(', ')}`);
  return kind;
}

/**
 * Every issue or pull request the text names as #N, each once, in the order
 * of the text; an HTML entity such as &#39; is no reference.
 */
export function textIssues(text: string): number[] {
  const found = [...text.matchAll(/(?<![&\w])#(\d+)\b/g)].map((m) =>
    Number(m[1]),
  );
  return [...new Set(found)];
}

/** Reads one entry; throws with the reason when it is malformed. */
export function parseEntry(name: string, content: string): LogEntry {
  const nameDate = NAME.exec(name)?.[1];
  if (!nameDate)
    throw new Error(`${name}: the name must be <date>-<short-name>.md`);
  const m = /^---\n(?<head>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/.exec(
    content.replace(/\r\n/g, '\n'),
  );
  if (!m?.groups) throw new Error(`${name}: front matter "---" is missing`);
  const fields = frontMatter(name, m.groups.head!);
  const when = entryDate(name, nameDate, fields.get('date'));
  const kind = checkKeys(name, fields);
  const issues = issueList(name, fields.get('issues'));
  // Each run of white space with a line break becomes one space. The match
  // starts only where a run starts, so it stays linear (#367).
  const text = m.groups.body!.trim().replace(/(?<!\s)\s*\n\s*/g, ' ');
  if (!text) throw new Error(`${name}: the text is empty`);
  if (issues.join() !== textIssues(text).join())
    throw new Error(
      `${name}: "issues" must list every #N of the text in its order`,
    );
  return { name, ...when, kind, issues, text };
}

/**
 * Newest date first. Within a date the entries with a time come first, the
 * newest first; those without a time, and those of the same time, by name.
 */
export function ordered(entries: readonly LogEntry[]): LogEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.time ?? '').localeCompare(a.time ?? '') ||
      a.name.localeCompare(b.name),
  );
}

/** One line of the page; a text in parentheses follows the kind directly. */
const line = (e: LogEntry): string =>
  `* **${e.kind}**${e.text.startsWith('(') ? ' ' : ': '}${e.text}`;

/** The log page as okf/log.md had it: one section per date, newest first. */
export function logMarkdown(entries: readonly LogEntry[]): string {
  const out = ['# Update log'];
  let date = '';
  for (const e of ordered(entries)) {
    if (e.date !== date) out.push('', `## ${e.date}`, '');
    date = e.date;
    out.push(line(e));
  }
  return `${out.join('\n')}\n`;
}

/** The reason of every malformed entry of a log folder, by file name. */
export function checkLog(dir: string): string[] {
  const errors: string[] = [];
  const old = path.join(path.dirname(dir), `${path.basename(dir)}.md`);
  if (existsSync(old))
    errors.push(
      `${path.basename(old)}: the log is one file per entry in ${path.basename(dir)}/, ${path.basename(old)} is removed`,
    );
  for (const name of readdirSync(dir).sort()) {
    try {
      // The name first: a folder or another file is never read.
      if (!NAME.test(name)) parseEntry(name, '');
      parseEntry(name, readFileSync(path.join(dir, name), 'utf8'));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return errors;
}

/** Every entry of a log folder, newest first; throws on a malformed one. */
export function readLog(dir: string): LogEntry[] {
  const errors = checkLog(dir);
  if (errors.length) throw new Error(errors.join('\n'));
  return ordered(
    readdirSync(dir).map((name) =>
      parseEntry(name, readFileSync(path.join(dir, name), 'utf8')),
    ),
  );
}

if (import.meta.main) {
  const [command] = process.argv.slice(2);
  if (command !== 'check') {
    console.error('usage: node scripts/okf-log.ts check');
    process.exit(2);
  }
  const dir = path.resolve(import.meta.dirname, '../okf/log');
  const errors = checkLog(dir);
  for (const error of errors) console.log(`::error::${error}`);
  if (errors.length) {
    console.log('The update log in okf/log is malformed (okf/ops/website.md).');
    process.exit(1);
  }
  console.log(
    `${readdirSync(dir).length} log entries in okf/log, all well-formed.`,
  );
}
