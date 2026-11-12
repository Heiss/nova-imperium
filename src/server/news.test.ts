import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { section } from '../../scripts/changelog.ts';
import {
  announceUpdate,
  entriesSince,
  loadNews,
  type News,
  type NewsVersion,
  parseChangelog,
  updateText,
  versionNumber,
} from './news.ts';
import { addUser, testCtx } from './test-helpers.ts';

const older = section('26.11.0', '01.11.2026', [
  { name: 'a.md', kind: 'neu', text: 'Die Nanitenfabrik.' },
]);
const newer = section('26.11.1', '12.11.2026', [
  { name: 'b.md', kind: 'neu', text: 'Neuigkeiten im Menü.' },
  { name: 'c.md', kind: 'geändert', text: 'Die Werft baut schneller.' },
  { name: 'd.md', kind: 'behoben', text: 'Ein Fehler ist weg.' },
]);
const changelog = `# Neuigkeiten\n\n${newer}\n${older}`;

describe('changelog for players', () => {
  it('orders versions as numbers and refuses anything but CalVer', () => {
    expect(versionNumber('26.11.19')).toBe(2_611_019);
    expect(versionNumber('26.12.0')).toBeGreaterThan(
      versionNumber('26.11.99')!,
    );
    expect(versionNumber('27.1.0')).toBeGreaterThan(
      versionNumber('26.12.999')!,
    );
    for (const bad of [
      '',
      'dev',
      '26.13.0',
      '26.0.1',
      '26.11.01',
      '26.11.1000',
      '126.11.1',
    ])
      expect(versionNumber(bad)).toBeNull();
  });

  it('reads back what scripts/changelog.ts writes', () => {
    expect(parseChangelog(changelog)).toEqual([
      {
        version: '26.11.1',
        date: '12.11.2026',
        entries: [
          { kind: 'neu', text: 'Neuigkeiten im Menü.' },
          { kind: 'geändert', text: 'Die Werft baut schneller.' },
          { kind: 'behoben', text: 'Ein Fehler ist weg.' },
        ],
      },
      {
        version: '26.11.0',
        date: '01.11.2026',
        entries: [{ kind: 'neu', text: 'Die Nanitenfabrik.' }],
      },
    ]);
    expect(
      parseChangelog(
        '## Version dev – 01.01.2026\n### Neu\n- x\n- \n### Sonstiges\n- y',
      ),
    ).toEqual([]);
    expect(parseChangelog('- lose\n### Neu\n- ohne Version')).toEqual([]);
    // Only whole lines count; indentation and line ends do not matter.
    expect(
      parseChangelog(
        [
          '  ## Version 26.11.1 – 12.11.2026  ',
          '### Neu',
          '  -  Eingerückt.  ',
          '-Ohne Abstand.',
          'x ## Version 26.11.2 – 13.11.2026',
          '## Version 26.11.3 – 13.11.2026 x',
          '- Noch Version 26.11.1.',
          '#### Neu',
          '- Unter einer falschen Überschrift.',
          'x### Behoben',
          '- Weiter unter Neu.',
          '### Behoben x',
          '- Ohne Art.',
        ].join('\r\n'),
      ),
    ).toEqual([
      {
        version: '26.11.1',
        date: '12.11.2026',
        entries: [
          { kind: 'neu', text: 'Eingerückt.' },
          { kind: 'neu', text: 'Noch Version 26.11.1.' },
          // Not a heading: the kind stays „Neu“.
          { kind: 'neu', text: 'Unter einer falschen Überschrift.' },
          { kind: 'neu', text: 'Weiter unter Neu.' },
        ],
      },
    ]);
  });

  it('collects the entries since the old version, newest first', () => {
    const versions = parseChangelog(changelog);
    const texts = (from: string, to: string): string[] =>
      entriesSince(versions, versionNumber(from)!, versionNumber(to)!).map(
        (e) => e.text,
      );
    expect(texts('26.10.5', '26.11.1')).toEqual([
      'Neuigkeiten im Menü.',
      'Die Werft baut schneller.',
      'Ein Fehler ist weg.',
      'Die Nanitenfabrik.',
    ]);
    expect(texts('26.11.0', '26.11.1')).toHaveLength(3);
    expect(texts('26.11.0', '26.11.0')).toEqual([]);
    // Newest first even when the file is in another order.
    expect(
      entriesSince([...versions].reverse(), 0, versionNumber('26.11.1')!).map(
        (e) => e.text,
      ),
    ).toEqual(texts('26.10.5', '26.11.1'));
    expect(texts('26.10.5', '26.11.0')).toEqual(['Die Nanitenfabrik.']);
  });

  it('lists the first three entries and counts the rest', () => {
    const e = (text: string) => ({ kind: 'neu' as const, text });
    expect(updateText('26.11.1', [])).toBeNull();
    expect(updateText('26.11.1', [e('A.')])).toBe(
      'Nova Imperium wurde auf Version 26.11.1 aktualisiert. Das ist neu:\n• A.\nAlle Versionen stehen unter „Neuigkeiten“.',
    );
    expect(
      updateText('26.11.1', [e('A.'), e('B.'), e('C.'), e('D.')]),
    ).toContain(
      '• C.\n… und 1 weitere Änderung. Alles steht unter „Neuigkeiten“.',
    );
    expect(
      updateText('26.11.1', [e('A.'), e('B.'), e('C.'), e('D.'), e('E.')]),
    ).toContain('… und 2 weitere Änderungen.');
    expect(updateText('26.11.1', [e('A.'), e('B.'), e('C.')])).toBe(
      'Nova Imperium wurde auf Version 26.11.1 aktualisiert. Das ist neu:\n• A.\n• B.\n• C.\nAlle Versionen stehen unter „Neuigkeiten“.',
    );
  });

  it('loads CHANGELOG.md and VERSION, both optional', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nova-news-'));
    expect(loadNews(dir)).toEqual({ version: null, versions: [] });
    writeFileSync(path.join(dir, 'VERSION'), '26.11.1\n');
    writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog);
    const news = loadNews(dir);
    expect(news.version).toBe('26.11.1');
    expect(news.versions).toHaveLength(2);
    writeFileSync(path.join(dir, 'VERSION'), 'dev\n');
    expect(loadNews(dir).version).toBeNull();
    // Only a missing file is optional; any other read error stops the start.
    const broken = mkdtempSync(path.join(tmpdir(), 'nova-news-'));
    mkdirSync(path.join(broken, 'VERSION'));
    expect(() => loadNews(broken)).toThrow();
  });
});

describe('update message', () => {
  const versions: NewsVersion[] = parseChangelog(changelog);
  const at = (version: string | null): News => ({ version, versions });
  const stored = (ctx: ReturnType<typeof testCtx>) =>
    (
      ctx.store.db
        .prepare("SELECT value FROM settings WHERE key = 'version'")
        .get() as { value: number } | undefined
    )?.value;

  it('tells only the running version on the first start, in development nothing', () => {
    const empty = testCtx();
    expect(announceUpdate(empty, at('26.11.1'))).toBe(0);
    expect(stored(empty)).toBe(2_611_001);
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    expect(announceUpdate(ctx, at(null))).toBe(0);
    expect(stored(ctx)).toBeUndefined();
    ctx.store.db
      .prepare("INSERT INTO push_subscriptions VALUES ('e', ?, 'k', 'a')")
      .run(anna.id);
    expect(announceUpdate(ctx, at('26.11.1'))).toBe(1);
    expect(stored(ctx)).toBe(2_611_001);
    const [report] = ctx.store.reports(anna.id);
    expect(report!.text).toContain('• Ein Fehler ist weg.');
    expect(report!.text).not.toContain('Nanitenfabrik');
    expect(
      ctx.store.db.prepare('SELECT kind, body FROM push_jobs').all(),
    ).toEqual([{ kind: 'messages', body: 'Nova Imperium 26.11.1 ist da.' }]);
    expect(report!.text).toContain(
      'Alle Versionen stehen unter „Neuigkeiten“.',
    );
  });

  it('tells every player once per new version, never after a rollback', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const ben = addUser(ctx, 'Ben');
    announceUpdate(ctx, at('26.10.5'));
    expect(announceUpdate(ctx, at('26.11.1'))).toBe(2);
    const [report] = ctx.store.reports(anna.id);
    expect(report).toMatchObject({
      type: 'info',
      title: 'Neu in Version 26.11.1',
      news: '26.11.1',
    });
    expect(report!.text).toContain('• Neuigkeiten im Menü.');
    expect(report!.text).toContain('… und 1 weitere Änderung.');
    expect(ctx.store.reports(ben.id)).toHaveLength(1);
    expect(announceUpdate(ctx, at('26.11.1'))).toBe(0);
    expect(announceUpdate(ctx, at('26.11.0'))).toBe(0);
    expect(stored(ctx)).toBe(2_611_001);
    expect(announceUpdate(ctx, at('26.11.1'))).toBe(0);
    expect(ctx.store.reports(anna.id)).toHaveLength(1);
  });

  it('stays silent for an update without entries but remembers it', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    expect(announceUpdate(ctx, at('26.11.0'))).toBe(1);
    expect(announceUpdate(ctx, at('26.11.2'))).toBe(1);
    expect(ctx.store.reports(anna.id)[0]!.text).toContain(
      'Neuigkeiten im Menü',
    );
    expect(announceUpdate(ctx, at('26.11.3'))).toBe(0);
    expect(stored(ctx)).toBe(2_611_003);
    expect(ctx.store.reports(anna.id)).toHaveLength(2);
  });
});
