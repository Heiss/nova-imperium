// The update log as one file per entry (#212): okf/log/<date>-<short-name>.md
// with the date, the kind and the issues in the front matter; the website
// builds the log page from the folder, newest first.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkLog,
  KINDS,
  type LogEntry,
  logMarkdown,
  ordered,
  parseEntry,
  readLog,
} from '../../scripts/okf-log.ts';

const root = path.resolve(import.meta.dirname, '../..');

const file = (head: string, text = 'Text.'): string =>
  `---\n${head}\n---\n\n${text}\n`;
const valid = (extra = ''): string =>
  file(`type: log-entry\ndate: 2026-11-14\nkind: Code${extra}`);

const entry = (
  name: string,
  date: string,
  kind: LogEntry['kind'],
  text: string,
  issues: number[] = [],
): LogEntry => ({ name, date, kind, issues, text });
/** An entry with a UTC time, as every entry from 2026-11-15 on has. */
const timed = (name: string, time: string): LogEntry => ({
  ...entry(name, name.slice(0, 10), 'Code', `${name}.`),
  time,
});
const DATE_FORMAT =
  '"date" must be a valid date YYYY-MM-DD or YYYY-MM-DDTHH:MM';

describe('log entries', () => {
  it('read the date, the kind, the issues and the text', () => {
    expect(
      parseEntry(
        '2026-11-14-guild-ranks.md',
        file(
          'type: log-entry\ndate: 2026-11-14\nkind: Decision and code\nissues: [163, 45]',
          '#163 built: guild ranks\n  with rights.',
        ),
      ),
    ).toEqual(
      entry(
        '2026-11-14-guild-ranks.md',
        '2026-11-14',
        'Decision and code',
        '#163 built: guild ranks with rights.',
        [163, 45],
      ),
    );
    expect(
      parseEntry(
        '2026-11-06-docs.md',
        '---\r\ntype: log-entry\r\ndate: 2026-11-06\r\nkind: Docs\r\n---\r\nREADME.',
      ),
    ).toEqual(entry('2026-11-06-docs.md', '2026-11-06', 'Docs', 'README.'));
  });

  it('know exactly the kinds the log used before the split', () => {
    expect(KINDS).toEqual([
      'Decision',
      'Decision and code',
      'Code',
      'Feature',
      'Fix',
      'Update',
      'Docs',
    ]);
  });

  it('refuse a name that is not <date>-<short-name>.md', () => {
    for (const name of [
      'guild-ranks.md',
      '2026-11-14.md',
      '2026-11-14-.md',
      '2026-11-14-Guild-Ranks.md',
      '2026-11-14-guild_ranks.md',
      '2026-11-14-guild--ranks.md',
      '2026-11-14-guild-ranks-.md',
      '2026-11-14-guild-ranks.txt',
      '2026-11-14-guild ranks.md',
      '26-11-14-guild-ranks.md',
      'x2026-11-14-guild-ranks.md',
      '2026-11-14/guild-ranks.md',
    ])
      expect(() => parseEntry(name, valid()), name).toThrow(
        `${name}: the name must be <date>-<short-name>.md`,
      );
    expect(parseEntry('2026-11-14-guild-ranks-2.md', valid()).name).toBe(
      '2026-11-14-guild-ranks-2.md',
    );
  });

  it('refuse a missing front matter and a line that is not "key: value"', () => {
    const name = '2026-11-14-x.md';
    expect(() => parseEntry(name, 'Text.')).toThrow(
      `${name}: front matter "---" is missing`,
    );
    expect(() => parseEntry(name, valid('\ntags:\n  - a'))).toThrow(
      `${name}: every front matter line is "key: value", not "tags:"`,
    );
    expect(() => parseEntry(name, valid('\nkind: Fix'))).toThrow(
      `${name}: "kind" is given twice`,
    );
  });

  it('refuse a type other than log-entry', () => {
    const name = '2026-11-14-x.md';
    expect(() =>
      parseEntry(name, file('date: 2026-11-14\nkind: Code')),
    ).toThrow(`${name}: "type" must be log-entry`);
    expect(() =>
      parseEntry(name, file('type: feature\ndate: 2026-11-14\nkind: Code')),
    ).toThrow(`${name}: "type" must be log-entry`);
  });

  it('refuse a missing or invalid date and a date other than the name', () => {
    const name = '2026-11-14-x.md';
    const withDate = (date: string): string =>
      file(`type: log-entry${date}\nkind: Code`);
    for (const date of [
      '',
      '\ndate: ',
      '\ndate: 14.11.2026',
      '\ndate: 2026-11-14x',
      '\ndate: 2026-13-01',
      '\ndate: 2026-02-30',
      '\ndate: 2026-00-10',
      '\ndate: 2026-11-00',
    ])
      expect(() => parseEntry(name, withDate(date)), date).toThrow(
        `${name}: "date" must be a valid date YYYY-MM-DD`,
      );
    expect(() => parseEntry(name, withDate('\ndate: 2026-11-15'))).toThrow(
      `${name}: "date" 2026-11-15 differs from the date of the name`,
    );
    expect(
      parseEntry('2028-02-29-leap.md', withDate('\ndate: 2028-02-29T12:00'))
        .date,
    ).toBe('2028-02-29');
    expect(
      parseEntry('2024-02-29-leap.md', withDate('\ndate: 2024-02-29')).date,
    ).toBe('2024-02-29');
    for (const [day, date] of [
      ['2027-02-29', '2027-02-29T12:00'],
      ['2025-02-29', '2025-02-29'],
    ])
      expect(
        () => parseEntry(`${day}-no-leap.md`, withDate(`\ndate: ${date}`)),
        date,
      ).toThrow(`"date" must be a valid date YYYY-MM-DD or YYYY-MM-DDTHH:MM`);
  });

  it('read a UTC time after the date (owner, 2026-11-15, O15)', () => {
    const withDate = (name: string, date: string): LogEntry =>
      parseEntry(name, file(`type: log-entry\ndate: ${date}\nkind: Code`));
    expect(withDate('2026-11-15-log-entries.md', '2026-11-15T00:30')).toEqual({
      ...entry('2026-11-15-log-entries.md', '2026-11-15', 'Code', 'Text.'),
      time: '00:30',
    });
    expect(withDate('2026-11-14-x.md', '2026-11-14T23:59').time).toBe('23:59');
    expect(withDate('2026-11-14-x.md', '2026-11-14').time).toBeUndefined();
  });

  it('refuse an invalid time', () => {
    const name = '2026-11-15-x.md';
    for (const date of [
      '2026-11-15T24:00',
      '2026-11-15T12:60',
      '2026-11-15T1:30',
      '2026-11-15T12:30Z',
      '2026-11-15T12:30:00',
      '2026-11-15 12:30',
      '2026-11-15T',
    ])
      expect(
        () =>
          parseEntry(name, file(`type: log-entry\ndate: ${date}\nkind: Code`)),
        date,
      ).toThrow(`${name}: ${DATE_FORMAT}`);
    expect(() =>
      parseEntry(
        '2026-11-14-x.md',
        file('type: log-entry\ndate: 2026-11-15T00:30\nkind: Code'),
      ),
    ).toThrow('"date" 2026-11-15T00:30 differs from the date of the name');
  });

  it('need the time from 2026-11-15 on, the entries before have none', () => {
    for (const day of ['2026-11-15', '2026-11-16', '2027-01-01']) {
      const name = `${day}-x.md`;
      expect(
        () =>
          parseEntry(name, file(`type: log-entry\ndate: ${day}\nkind: Code`)),
        day,
      ).toThrow(
        `${name}: "date" needs a UTC time from 2026-11-15 on, like ${day}T00:30`,
      );
    }
    expect(
      parseEntry(
        '2026-11-14-x.md',
        file('type: log-entry\ndate: 2026-11-14\nkind: Code'),
      ).date,
    ).toBe('2026-11-14');
  });

  it('refuse a missing or unknown kind', () => {
    const name = '2026-11-14-x.md';
    for (const kind of ['', '\nkind: Bugfix', '\nkind: code', '\nkind: '])
      expect(
        () =>
          parseEntry(name, file(`type: log-entry\ndate: 2026-11-14${kind}`)),
        kind,
      ).toThrow(`${name}: "kind" must be one of ${KINDS.join(', ')}`);
  });

  it('refuse issues that are not a list of numbers', () => {
    const name = '2026-11-14-x.md';
    for (const issues of ['191', '[]', '[#191]', '[191,]', '[0]', '[1 2]'])
      expect(
        () => parseEntry(name, valid(`\nissues: ${issues}`)),
        issues,
      ).toThrow(`${name}: "issues" must be a list like [191, 118]`);
    expect(parseEntry(name, valid('\nissues: [191,118]')).issues).toEqual([
      191, 118,
    ]);
  });

  it('refuse a description that contains ": "', () => {
    const name = '2026-11-14-x.md';
    for (const d of ['a: b', "'a: b'", '"a: b"'])
      expect(() => parseEntry(name, valid(`\ndescription: ${d}`)), d).toThrow(
        `${name}: "description" must not contain ": "`,
      );
    expect(
      parseEntry(name, valid('\ndescription: The 12:30 run, a:b')).text,
    ).toBe('Text.');
  });

  it('refuse an empty text', () => {
    const name = '2026-11-14-x.md';
    expect(() =>
      parseEntry(
        name,
        file('type: log-entry\ndate: 2026-11-14\nkind: Code', '  '),
      ),
    ).toThrow(`${name}: the text is empty`);
  });
});

describe('the log page', () => {
  const a = entry('2026-11-13-b.md', '2026-11-13', 'Code', 'B.');
  const b = entry('2026-11-14-z.md', '2026-11-14', 'Fix', 'Z.');
  const c = entry('2026-11-14-a.md', '2026-11-14', 'Decision', 'A.');
  const d = entry('2026-11-06-a.md', '2026-11-06', 'Docs', 'D.');

  it('orders the newest date first, within a date by name', () => {
    expect(ordered([a, b, d, c]).map((e) => e.name)).toEqual([
      '2026-11-14-a.md',
      '2026-11-14-z.md',
      '2026-11-13-b.md',
      '2026-11-06-a.md',
    ]);
    expect(ordered([c, b, a, d])).toEqual(ordered([d, a, b, c]));
  });

  it('lists the entries with a time first within a date, the newest first', () => {
    const late = timed('2026-11-14-late.md', '23:05');
    const early = timed('2026-11-14-early.md', '00:30');
    const same = timed('2026-11-14-another.md', '23:05');
    const next = timed('2026-11-15-next.md', '00:01');
    expect(
      ordered([c, early, a, b, late, next, same]).map((e) => e.name),
    ).toEqual([
      '2026-11-15-next.md',
      '2026-11-14-another.md',
      '2026-11-14-late.md',
      '2026-11-14-early.md',
      '2026-11-14-a.md',
      '2026-11-14-z.md',
      '2026-11-13-b.md',
    ]);
    expect(logMarkdown([b, early, late])).toBe(
      [
        '# Update log',
        '',
        '## 2026-11-14',
        '',
        '* **Code**: 2026-11-14-late.md.',
        '* **Code**: 2026-11-14-early.md.',
        '* **Fix**: Z.',
        '',
      ].join('\n'),
    );
  });

  it('groups the entries under one heading per date, as okf/log.md did', () => {
    const porting = entry(
      '2026-11-06-porting-fixes.md',
      '2026-11-06',
      'Fix',
      '(found while porting): a cookie part.',
    );
    expect(logMarkdown([d, a, b, c, porting])).toBe(
      [
        '# Update log',
        '',
        '## 2026-11-14',
        '',
        '* **Decision**: A.',
        '* **Fix**: Z.',
        '',
        '## 2026-11-13',
        '',
        '* **Code**: B.',
        '',
        '## 2026-11-06',
        '',
        '* **Docs**: D.',
        '* **Fix** (found while porting): a cookie part.',
        '',
      ].join('\n'),
    );
    expect(logMarkdown([])).toBe('# Update log\n');
  });

  it('is read from a folder, and every malformed entry is named', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'okf-log-'));
    writeFileSync(path.join(dir, '2026-11-14-a.md'), valid());
    writeFileSync(
      path.join(dir, '2026-11-13-b.md'),
      file('type: log-entry\ndate: 2026-11-13\nkind: Fix'),
    );
    expect(readLog(dir).map((e) => e.name)).toEqual([
      '2026-11-14-a.md',
      '2026-11-13-b.md',
    ]);
    expect(checkLog(dir)).toEqual([]);

    writeFileSync(path.join(dir, 'notes.txt'), 'x');
    writeFileSync(path.join(dir, '2026-11-14-c.md'), valid('\nkind: Fix'));
    mkdirSync(path.join(dir, '2026-11-12'));
    expect(checkLog(dir)).toEqual([
      '2026-11-12: the name must be <date>-<short-name>.md',
      '2026-11-14-c.md: "kind" is given twice',
      'notes.txt: the name must be <date>-<short-name>.md',
    ]);
    expect(() => readLog(dir)).toThrow(
      '2026-11-12: the name must be <date>-<short-name>.md\n2026-11-14-c.md',
    );
  });

  it('refuses a log.md next to the folder (D3: one source)', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'okf-'));
    const dir = path.join(parent, 'log');
    mkdirSync(dir);
    writeFileSync(path.join(dir, '2026-11-14-a.md'), valid());
    expect(checkLog(dir)).toEqual([]);
    writeFileSync(path.join(parent, 'log.md'), '# Update log\n');
    expect(checkLog(dir)).toEqual([
      'log.md: the log is one file per entry in log/, log.md is removed',
    ]);
  });
});

describe('okf/log', () => {
  it('holds only well-formed entries, and okf/log.md is gone (D3)', () => {
    expect(checkLog(path.join(root, 'okf/log'))).toEqual([]);
    expect(readLog(path.join(root, 'okf/log')).length).toBeGreaterThan(0);
  });
});
