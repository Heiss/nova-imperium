// The builders of the rule pages (#288, #289): what each one makes of its
// words and values, on hand-made input.
import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from '../catalog.ts';
import { text } from '../text.ts';
import {
  costText,
  count,
  days,
  duration,
  facts,
  formulas,
  hours,
  minutes,
  nameOf,
  number,
  percent,
  requires,
  say,
  section,
  steps,
  table,
} from './say.ts';
import { TARGET_NAMES } from './targets.ts';

const name = (key: string): string => text(key)!.n;

describe('a paragraph', () => {
  it('has its values only when it is given some', () => {
    expect(say('Ein Text.')).toEqual({ t: 'text', text: 'Ein Text.' });
    expect(say('Ein Text.')).not.toHaveProperty('values');
    expect(say('Ab {n}.', { n: '3' })).toEqual({
      t: 'text',
      text: 'Ab {n}.',
      values: { n: '3' },
    });
  });
});

describe('a formula block', () => {
  it('fills the values of each formula and keeps the formulas for the guards', () => {
    const f = {
      text: 'a = {x} · b',
      values: { x: '2' },
      fn: (b: number) => 2 * b,
      rule: (b: number) => b + b,
      samples: [[1]],
    };
    const g = {
      text: 'c = d',
      fn: (d: number) => d,
      rule: (d: number) => d,
      samples: [[1]],
    };
    expect(formulas(f, g)).toEqual({
      t: 'formula',
      lines: ['a = 2 · b', 'c = d'],
      of: [f, g],
    });
  });
});

describe('a table', () => {
  it('has its caption, head and rows as given', () => {
    expect(
      table(
        'Titel',
        ['A', 'B'],
        [
          [1, 'x'],
          [2, { text: 'y', link: 'z' }],
        ],
      ),
    ).toEqual({
      t: 'table',
      caption: 'Titel',
      head: ['A', 'B'],
      rows: [{ cells: [1, 'x'] }, { cells: [2, { text: 'y', link: 'z' }] }],
    });
  });

  it('marks the rows the callback names, and only them', () => {
    const t = table('T', ['A'], [[1], [2], [3]], (i) => i === 1);
    expect(t).toMatchObject({
      rows: [{ cells: [1] }, { cells: [2], mark: true }, { cells: [3] }],
    });
    if (t.t !== 'table') throw new Error('no table');
    expect(t.rows[0]).not.toHaveProperty('mark');
    expect(t.rows[2]).not.toHaveProperty('mark');
  });

  it('hands the callback the index of the row', () => {
    const seen: number[] = [];
    table('T', ['A'], [[1], [2], [3]], (i) => {
      seen.push(i);
      return false;
    });
    expect(seen).toEqual([0, 1, 2]);
  });

  it('copies the cells of a row, so a later change of the input does not reach it', () => {
    const cells = [1, 2];
    const t = table('T', ['A', 'B'], [cells]);
    cells.push(3);
    expect(t).toMatchObject({ rows: [{ cells: [1, 2] }] });
  });
});

describe('facts, steps and sections', () => {
  it('labels each fact with its text', () => {
    expect(
      facts([
        ['Eins', 'a'],
        ['Zwei', 'b'],
      ]),
    ).toEqual({
      t: 'facts',
      items: [
        { label: 'Eins', text: 'a' },
        { label: 'Zwei', text: 'b' },
      ],
    });
  });

  it('numbers the steps from 1', () => {
    expect(steps('Erst', 'Dann', 'Zuletzt')).toEqual({
      t: 'facts',
      items: [
        { label: 'Schritt 1', text: 'Erst' },
        { label: 'Schritt 2', text: 'Dann' },
        { label: 'Schritt 3', text: 'Zuletzt' },
      ],
    });
  });

  it('is an id, a title and the blocks in order', () => {
    const a = say('A');
    const b = say('B');
    expect(section('id', 'Titel', a, b)).toEqual({
      id: 'id',
      title: 'Titel',
      blocks: [a, b],
    });
    expect(section('id', 'Titel').blocks).toEqual([]);
  });
});

describe('the name of an entry', () => {
  it('is its name, or the key for an unknown entry', () => {
    expect(nameOf('yard')).toBe(name('yard'));
    expect(nameOf('gibtesnicht')).toBe('gibtesnicht');
  });
});

describe('numbers and units', () => {
  it('formats numbers and shares as German', () => {
    expect(number(50000)).toBe('50.000');
    expect(number(1.5)).toBe('1,5');
    expect(number(1.234)).toBe('1,23');
    expect(percent(0.1)).toBe('10 %');
    expect(percent(0.125)).toBe('12,5 %');
  });

  it('says one in the singular, every other number in the plural', () => {
    expect(count(1, 'Ding', 'Dinge')).toBe('1 Ding');
    expect(count(0, 'Ding', 'Dinge')).toBe('0 Dinge');
    expect(count(2, 'Ding', 'Dinge')).toBe('2 Dinge');
    expect(count(1000, 'Ding', 'Dinge')).toBe('1.000 Dinge');
  });

  it('has the units of the pages', () => {
    expect(hours(1)).toBe('1 Stunde');
    expect(hours(48)).toBe('48 Stunden');
    expect(days(1)).toBe('1 Tag');
    expect(days(7)).toBe('7 Tage');
    expect(minutes(1)).toBe('1 Minute');
    expect(minutes(15)).toBe('15 Minuten');
  });
});

describe('a duration', () => {
  it('is seconds below a minute', () => {
    expect(duration(0)).toBe('0 Sek.');
    expect(duration(12000)).toBe('12 Sek.');
    expect(duration(59000)).toBe('59 Sek.');
  });

  it('rounds to whole seconds', () => {
    expect(duration(1499)).toBe('1 Sek.');
    expect(duration(1500)).toBe('2 Sek.');
  });

  it('is minutes and seconds from a minute on', () => {
    expect(duration(60000)).toBe('1 Min. 0 Sek.');
    expect(duration(250000)).toBe('4 Min. 10 Sek.');
    expect(duration(3599000)).toBe('59 Min. 59 Sek.');
  });

  it('is hours and minutes from an hour on, without the seconds', () => {
    expect(duration(3600000)).toBe('1 Std. 0 Min.');
    expect(duration(3905000)).toBe('1 Std. 5 Min.');
    expect(duration(3725000)).toBe('1 Std. 2 Min.');
    expect(duration(3600000 * 1234)).toBe('1.234 Std. 0 Min.');
  });
});

describe('what an entry needs, as a link list', () => {
  const link = (id: string, level: number): string =>
    `[[${id}|${name(id)}]] Stufe ${level}`;

  it('lists the buildings, then the research, of a ship', () => {
    const req = SHIPS.colony!.req;
    expect(requires('colony')).toBe(
      [
        ...Object.entries(req.b ?? {}).map(([id, l]) => link(id, l)),
        ...Object.entries(req.r ?? {}).map(([id, l]) => link(id, l)),
      ].join(', '),
    );
    expect(requires('colony')).toContain(', ');
    expect(requires('colony')).toContain(link('yard', req.b!.yard!));
  });

  it('reads the requirements of a building, a research and a defense', () => {
    expect(requires('nanite')).toBe(
      `${link('robot', BUILD.nanite!.req.b!.robot!)}, ${link('computer', BUILD.nanite!.req.r!.computer!)}`,
    );
    expect(requires('spy')).toBe(link('lab', RES.spy!.req.b!.lab!));
    expect(requires('rl')).toBe(link('yard', DEF.rl!.req.b!.yard!));
  });

  it('is empty for an entry without requirements and for an unknown key', () => {
    expect(requires('metal')).toBe('');
    expect(requires('gibtesnicht')).toBe('');
  });
});

describe('a cost as words', () => {
  it('names each resource that costs something', () => {
    expect(costText([60, 15, 0])).toBe('60 Adamant und 15 Psikristall');
    expect(costText([1000, 2, 3])).toBe(
      '1.000 Adamant, 2 Psikristall und 3 Promethium',
    );
  });

  it('leaves out what is 0, wherever it stands', () => {
    expect(costText([0, 15, 3])).toBe('15 Psikristall und 3 Promethium');
    expect(costText([60, 0, 3])).toBe('60 Adamant und 3 Promethium');
    expect(costText([0, 0, 5])).toBe('5 Promethium');
    expect(costText([7, 0, 0])).toBe('7 Adamant');
  });

  it('is empty for a cost of nothing', () => {
    expect(costText([0, 0, 0])).toBe('');
  });
});

describe('the names of the targets of a mission', () => {
  it('are the words the fleet view uses', () => {
    expect(TARGET_NAMES).toEqual({
      own: 'eigener Planet',
      foreign: 'fremder Planet',
      ally: 'Planet eines Gildenmitglieds oder Freundes',
      any: 'jeder Planet',
      free: 'Freie Position',
      debris: 'Trümmerfeld',
      foreignMoon: 'fremder Mond',
      expedition: 'Expeditionsposition',
    });
  });
});
