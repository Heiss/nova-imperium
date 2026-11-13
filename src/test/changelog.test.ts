import { describe, expect, it } from 'vitest';
import {
  type Fragment,
  germanDate,
  MAX_TEXT,
  missingFragment,
  nextVersion,
  ordered,
  parseFragment,
  prepend,
  section,
  sectionOf,
} from '../../scripts/changelog.ts';

const f = (name: string, kind: Fragment['kind'], text: string): Fragment => ({
  name,
  kind,
  text,
});

describe('changelog fragments', () => {
  it('read the kind and join the text to one line', () => {
    expect(
      parseFragment(
        'werft.md',
        '---\nart: geändert\n---\nDie Werft baut\n  schneller.\n',
      ),
    ).toEqual(f('werft.md', 'geändert', 'Die Werft baut schneller.'));
    expect(parseFragment('a.md', '---\r\nart: neu\r\n---\r\nText.')).toEqual(
      f('a.md', 'neu', 'Text.'),
    );
  });

  it('refuse a missing head, an unknown kind, no text, headings and long text', () => {
    expect(() => parseFragment('a.md', 'Text.')).toThrow(
      'a.md: front matter "---" is missing',
    );
    expect(() => parseFragment('a.md', '---\nart: toll\n---\nText.')).toThrow(
      'a.md: "art" must be one of neu, geändert, behoben',
    );
    expect(() => parseFragment('a.md', '---\nart: neu\n---\n  \n')).toThrow(
      'a.md: the text is empty',
    );
    expect(() => parseFragment('a.md', '---\nart: neu\n---\n# Titel')).toThrow(
      'a.md: no headings, one entry only',
    );
    const long = 'x'.repeat(MAX_TEXT + 1);
    expect(() => parseFragment('a.md', `---\nart: neu\n---\n${long}`)).toThrow(
      `a.md: the text has more than ${MAX_TEXT} characters`,
    );
    expect(
      parseFragment('a.md', `---\nart: neu\n---\n${'x'.repeat(MAX_TEXT)}`).text,
    ).toHaveLength(MAX_TEXT);
  });

  it('list new before changed before fixed, then by file name', () => {
    expect(
      ordered([
        f('b.md', 'behoben', 'B'),
        f('z.md', 'neu', 'Z'),
        f('c.md', 'geändert', 'C'),
        f('a.md', 'neu', 'A'),
      ]).map((x) => x.name),
    ).toEqual(['a.md', 'z.md', 'c.md', 'b.md']);
  });
});

describe('changelog sections', () => {
  const fragments = [
    f('b.md', 'behoben', 'Ein Fehler ist weg.'),
    f('a.md', 'neu', 'Die Nanitenfabrik.'),
  ];
  const part = section('26.11.19', '12.11.2026', fragments);

  it('group the entries under German headings, empty kinds left out', () => {
    expect(part).toBe(
      [
        '## Version 26.11.19 – 12.11.2026',
        '',
        '### Neu',
        '',
        '- Die Nanitenfabrik.',
        '',
        '### Behoben',
        '',
        '- Ein Fehler ist weg.',
        '',
      ].join('\n'),
    );
  });

  it('put the newest section first and find each one again', () => {
    const first = prepend('', part);
    expect(first.startsWith('# Neuigkeiten\n\n## Version 26.11.19')).toBe(true);
    const older = section('26.11.20', '13.11.2026', [
      f('c.md', 'neu', 'Mehr.'),
    ]);
    const both = prepend(first, older);
    expect(both.indexOf('26.11.20')).toBeLessThan(both.indexOf('26.11.19'));
    expect(both.match(/# Neuigkeiten/g)).toHaveLength(1);
    expect(sectionOf(both, '26.11.19')).toBe(part);
    expect(sectionOf(both, '26.11.20')).toBe(older);
    expect(sectionOf(both, '26.11.2')).toBeNull();
    expect(sectionOf(both, '26.11.99')).toBeNull();
  });
});

describe('versions', () => {
  const november = new Date('2026-11-12T10:00:00Z');

  it('count up within the month and start at 0 in a new one', () => {
    expect(nextVersion(['26.11.0', '26.11.18', '26.11.9'], november)).toBe(
      '26.11.19',
    );
    expect(
      nextVersion(['26.10.4', 'v1', '26.11.x', '26.11.01'], november),
    ).toBe('26.11.0');
    expect(nextVersion([], new Date('2026-12-31T23:30:00Z'))).toBe('27.1.0');
  });

  it('date in German in Berlin time: 23:30 UTC is already the next day', () => {
    expect(germanDate(new Date('2026-11-12T23:30:00Z'))).toBe('13.11.2026');
  });
});

describe('fragment check', () => {
  it('needs a fragment for game code, unless labelled', () => {
    const game = ['src/core/economy.ts', 'src/client/main.ts'];
    expect(missingFragment(game, [])).toBe(
      'The game changes (src/core/economy.ts, src/client/main.ts) need a fragment in changes/ (German, see changes/README.md), or the label "kein-changelog".',
    );
    expect(missingFragment(game, ['kein-changelog'])).toBeNull();
    expect(missingFragment([...game, 'changes/eco.md'], [])).toBeNull();
    expect(missingFragment([...game, 'changes/README.md'], [])).not.toBeNull();
    expect(missingFragment([...game, 'changes/sub/eco.md'], [])).not.toBeNull();
    expect(missingFragment([...game, 'changes/eco.txt'], [])).not.toBeNull();
    // A deleted fragment is none; a deleted game file still needs one.
    expect(
      missingFragment(
        ['src/client/old.ts', 'changes/eco.md'],
        [],
        ['src/client/old.ts', 'changes/eco.md'],
      ),
    ).not.toBeNull();
    expect(
      missingFragment(['src/server/http/app.ts', 'okf/x.md'], []),
    ).toBeNull();
    // The entries and missions in their feature folders are game code (#112).
    expect(missingFragment(['src/features/sat/entry.ts'], [])).not.toBeNull();
    expect(
      missingFragment(
        [
          'src/server/game/a.ts',
          'src/core/b.ts',
          'src/client/c.ts',
          'src/client/d.ts',
        ],
        [],
      ),
    ).toContain('src/client/c.ts, …)');
  });
});
