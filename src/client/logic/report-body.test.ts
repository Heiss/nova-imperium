// The values of the bodies of the battle, espionage and survey reports (#330;
// the HTML of #118, bundle 4), on reports built by hand: the exact rows and
// texts, so a changed word, number or flag shows.
// `src/test/report-body-reference.test.ts` compares the components that show
// them with the frozen HTML on generated reports.
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import {
  reportBody,
  type BattleBody,
  type BattleSide,
  type SpyBody,
  type UnitRow,
} from './report-body.ts';
import { resLine } from './format.ts';
import type { Report } from './types.ts';

const n = (key: string): string => text(key)!.n;

const report = (type: Report['type'], o: Record<string, unknown>): Report => ({
  id: 'r1',
  time: 1,
  title: 'Bericht',
  type,
  name: 'Beta <i>',
  coords: { g: 1, s: 2, p: 6 },
  ...o,
});

/** A battle with only the fields it must have; the sides hold no units. */
const battle = (o: Record<string, unknown> = {}): BattleBody =>
  reportBody(
    report('battle', {
      rounds: 1,
      attName: 'A',
      defName: 'B',
      winner: 'att',
      ...o,
    }),
  ) as BattleBody;

const row = (key: string, b: string, a: string, lost: string, bad: boolean) =>
  ({ name: n(key), before: b, after: a, lost, bad }) satisfies UnitRow;

const TECH = (w: number, s: number, a: number): string =>
  `Waffen ${w}% · Schilde ${s}% · Panzerung ${a}%`;

describe('the body of a report', () => {
  it('is only made for a battle, an espionage and a survey report', () => {
    expect(reportBody(report('info', { text: 'Hallo' }))).toBeNull();
    expect(
      reportBody(
        report('survey', {
          tier: 'rough',
          orbit: 'middle',
          size: 'large',
          range: { min: 100, max: 200 },
          around: 20,
          planetType: 'normal',
        }),
      )?.kind,
    ).toBe('survey');
    expect(reportBody(report('battle', { rounds: 1 }))?.kind).toBe('battle');
    expect(reportBody(report('spy', { res: { m: 0, c: 0, d: 0 } }))?.kind).toBe(
      'spy',
    );
  });
});

describe('the body of a battle report', () => {
  it('shows the sides, the loss of each unit, the winner and what the battle left', () => {
    const body = battle({
      rounds: 3,
      attName: 'Anna',
      defName: 'Bert',
      attTech: { weapons: 2, shield: 1 },
      defTech: { armor: 3 },
      attBefore: { lf: 4, sc: 0 },
      attAfter: { lf: 1 },
      defBefore: { lf: 2, rl: 3 },
      defAfter: { rl: 1 },
      rebuilt: { rl: 2, ll: 1 },
      held: [
        {
          name: 'Cora <b>',
          before: { sc: 5 },
          after: { sc: 5 },
          tech: { weapons: 1 },
        },
      ],
      winner: 'att',
      loot: { m: 5, c: 4, d: 3 },
      debris: { m: 1000, c: 20 },
      moonChance: 12,
      moon: true,
      moonbreak: { chance: 30, broken: true, loss: 10, lost: true },
      moonLost: true,
    });
    expect(body).toEqual({
      kind: 'battle',
      head: 'Schlacht bei Beta <i> [1:2:6] · 3 Runde(n)',
      sides: [
        {
          cls: 'fl-attack',
          title: 'Angreifer Anna',
          tech: TECH(20, 10, 0),
          units: [row('lf', '4', '1', '3', true)],
          rebuilt: null,
          share: null,
          handed: null,
        },
        {
          cls: 'good',
          title: 'Verteidiger Bert',
          tech: TECH(0, 0, 30),
          units: [
            row('lf', '2', '0', '2', true),
            row('rl', '3', '1', '2', true),
          ],
          rebuilt: `2 ${n('rl')}, 1 ${n('ll')}`,
          share: null,
          handed: null,
        },
        {
          cls: 'good',
          title: 'Verteidiger Cora <b>',
          tech: TECH(10, 0, 0),
          units: [row('sc', '5', '5', '0', false)],
          rebuilt: null,
          share: null,
          handed: null,
        },
      ],
      winner: 'Der Angreifer hat die Schlacht gewonnen!',
      loot: 'Adamant 5 · Psikristall 4 · Promethium 3',
      lines: [
        'Es entstand ein Trümmerfeld mit 1.000 Adamant und 20 Psikristall.',
        'Mondchance: 12 %',
        'Die enormen Mengen an freiem Adamant und Psikristall ziehen sich an und formen einen Trabanten um den Planeten.',
        'Der Mond ist zerbrochen (Chance 30 %).',
        'Die Weltenbrecher wurden vom eigenen Schuss zerrissen (Chance 10 %).',
        'Dein Mond bei [1:2:6] wurde zerstört.',
      ],
    });
  });

  it('has no units for a side without units and shows no extra lines', () => {
    expect(battle({ winner: 'def' })).toEqual({
      kind: 'battle',
      head: 'Schlacht bei Beta <i> [1:2:6] · 1 Runde(n)',
      sides: [
        {
          cls: 'fl-attack',
          title: 'Angreifer A',
          tech: TECH(0, 0, 0),
          units: [],
          rebuilt: null,
          share: null,
          handed: null,
        },
        {
          cls: 'good',
          title: 'Verteidiger B',
          tech: TECH(0, 0, 0),
          units: [],
          rebuilt: null,
          share: null,
          handed: null,
        },
      ],
      winner: 'Der Verteidiger hat die Schlacht gewonnen!',
      loot: null,
      lines: [],
    });
  });

  it('names the winner, or nothing for an unknown result', () => {
    expect(battle({ winner: 'att' }).winner).toBe(
      'Der Angreifer hat die Schlacht gewonnen!',
    );
    expect(battle({ winner: 'draw' }).winner).toBe(
      'Die Schlacht endet unentschieden.',
    );
    expect(battle({ winner: 'x' }).winner).toBe('');
    expect(battle({ winner: undefined }).winner).toBe('');
  });

  it('lists only the units that were there, ships for the attacker, ships and defense for the defender', () => {
    const [att, def] = battle({
      attBefore: { lf: 3, rl: 4 },
      attAfter: { lf: 5 },
      defBefore: { lf: 1, rl: 4, sc: 0 },
      defAfter: {},
    }).sides;
    // A unit that grew is no loss, and a defense is no ship of the attacker.
    expect(att!.units).toEqual([row('lf', '3', '5', '-2', false)]);
    expect(def!.units).toEqual([
      row('lf', '1', '0', '1', true),
      row('rl', '4', '0', '4', true),
    ]);
  });

  it('marks a unit only when some of it was lost', () => {
    const units = (before: number, after: number): UnitRow[] =>
      battle({ attBefore: { lf: before }, attAfter: { lf: after } }).sides[0]!
        .units;
    expect(units(2, 1)[0]!.bad).toBe(true);
    expect(units(2, 2)[0]!.bad).toBe(false);
    expect(units(2, 3)[0]!.bad).toBe(false);
  });

  it('shows the loot only when something was taken', () => {
    expect(battle({ loot: { m: 0, c: 0, d: 0 } }).loot).toBeNull();
    expect(battle({}).loot).toBeNull();
    expect(battle({ loot: { m: 0, c: 0, d: 2 } }).loot).toBe(
      'Adamant 0 · Psikristall 0 · Promethium 2',
    );
    for (const loot of [
      { m: 1, c: 0, d: 0 },
      { m: 0, c: 3, d: 0 },
      // Resources do not cancel out.
      { m: 1, c: 1, d: 0 },
      { m: 1, c: 0, d: 1 },
    ])
      expect(battle({ loot }).loot).not.toBeNull();
  });

  it('shows the rebuilt defense only when something was rebuilt', () => {
    const rebuilt = (o: Record<string, unknown>): string | null =>
      battle(o).sides[1]!.rebuilt;
    expect(rebuilt({ rebuilt: {} })).toBeNull();
    expect(rebuilt({ rebuilt: { rl: 0 } })).toBeNull();
    expect(rebuilt({})).toBeNull();
    expect(rebuilt({ rebuilt: { rl: 1000 } })).toBe(`1.000 ${n('rl')}`);
  });

  it('keeps the key of a rebuilt unit that has no name', () => {
    expect(battle({ rebuilt: { unknownUnit: 2 } }).sides[1]!.rebuilt).toBe(
      '2 unknownUnit',
    );
  });

  it('lists the lines after the winner one per line, and none for nothing', () => {
    expect(battle({ debris: { m: 0, c: 0 } }).lines).toEqual([]);
    expect(battle({ debris: { m: 0, c: 7 } }).lines).toEqual([
      'Es entstand ein Trümmerfeld mit 0 Adamant und 7 Psikristall.',
    ]);
    expect(battle({ moonChance: 5, moonLost: true }).lines).toEqual([
      'Mondchance: 5 %',
      'Dein Mond bei [1:2:6] wurde zerstört.',
    ]);
  });

  it('shows each fleet that held as a defender of its own, none when none held', () => {
    const defenders = (o: Record<string, unknown>): BattleSide[] =>
      battle(o).sides.filter((s) => s.cls === 'good');
    expect(defenders({ held: [] })).toHaveLength(1);
    expect(defenders({})).toHaveLength(1);
    const [, cora, dirk] = defenders({
      held: [
        { name: 'Cora', before: { sc: 2 }, after: { sc: 1 }, tech: {} },
        { name: 'Dirk', before: {}, after: {}, tech: { shield: 2 } },
      ],
    });
    expect(cora).toEqual({
      cls: 'good',
      title: 'Verteidiger Cora',
      tech: TECH(0, 0, 0),
      units: [row('sc', '2', '1', '1', true)],
      rebuilt: null,
      share: null,
      handed: null,
    });
    expect(dirk).toMatchObject({ tech: TECH(0, 20, 0), units: [] });
  });

  it('shows the cargo a fleet that held handed to the planet, none when it handed none (#467)', () => {
    const [, cora, dirk] = battle({
      held: [
        {
          name: 'Cora',
          before: { sc: 2 },
          after: { sc: 1 },
          tech: {},
          handed: { m: 1200, c: 0, d: 30 },
        },
        {
          name: 'Dirk',
          before: {},
          after: {},
          tech: {},
          handed: { m: 0, c: 0, d: 0 },
        },
      ],
    }).sides.filter((s) => s.cls === 'good');
    expect(cora!.handed).toBe(resLine({ m: 1200, c: 0, d: 30 }));
    expect(dirk!.handed).toBeNull();
  });

  it('lists only ships for a fleet that held, and nothing of a missing side', () => {
    const [, , held] = battle({
      held: [{ name: 'Cora', before: { sc: 2, rl: 3 } }],
    }).sides;
    expect(held!.units).toEqual([row('sc', '2', '0', '2', true)]);
  });

  it('keeps the names and the number of rounds as they are, text a component escapes', () => {
    const body = battle({ attName: '<a>', defName: '"b"', rounds: '<6>' });
    expect(body.sides.map((s) => s.title)).toEqual([
      'Angreifer <a>',
      'Verteidiger "b"',
    ]);
    expect(body.head).toContain('<6> Runde(n)');
  });

  it('shows nothing for a name, place or rounds an old report lacks', () => {
    expect(
      reportBody({
        ...report('battle', {}),
        name: undefined,
        coords: undefined,
      }),
    ).toMatchObject({
      head: 'Schlacht bei  [?] ·  Runde(n)',
      sides: [{ title: 'Angreifer ' }, { title: 'Verteidiger ' }],
    });
  });
});

describe('the body of an espionage report', () => {
  const spy = (o: Record<string, unknown> = {}): SpyBody =>
    reportBody(
      report('spy', {
        defName: 'Bert <i>',
        res: { m: 5, c: 4, d: 3 },
        counter: 12,
        ...o,
      }),
    ) as SpyBody;
  const titles = (b: SpyBody): string[] => b.sections.map((s) => s.title);

  it('shows the resources and the chance of the counter-espionage, and a hint for a report with no details', () => {
    expect(spy()).toEqual({
      kind: 'spy',
      head: 'Rohstoffe auf Beta <i> [1:2:6] (Spieler Bert <i>):',
      res: 'Adamant 5 · Psikristall 4 · Promethium 3',
      sections: [],
      counter: '12',
      lost: false,
      hint: true,
    });
  });

  it('says that the spy skulls were destroyed, without the hint', () => {
    const body = spy({ lost: true });
    expect(body.lost).toBe(true);
    expect(body.hint).toBe(false);
  });

  it('shows every part that the spy saw, in its order', () => {
    const body = spy({
      activity: { recent: true },
      ships: { lf: 2, sc: 1000, rl: 5 },
      held: [
        { name: 'Cora', ships: { sc: 1, lf: 2 } },
        { name: 'Dirk <b>', ships: {} },
      ],
      def: { rl: 3 },
      b: { metal: 3 },
      r: { spy: 2 },
    });
    expect(body.sections).toEqual([
      { title: 'Aktivität', entries: [{ label: null, list: 'Aktiv' }] },
      {
        title: 'Flotte',
        entries: [{ label: null, list: `${n('sc')}: 1.000 · ${n('lf')}: 2` }],
      },
      {
        title: 'Gehaltene Flotten',
        entries: [
          { label: 'Cora', list: `${n('sc')}: 1 · ${n('lf')}: 2` },
          { label: 'Dirk <b>', list: null },
        ],
      },
      {
        title: 'Verteidigung',
        entries: [{ label: null, list: `${n('rl')}: 3` }],
      },
      {
        title: 'Gebäude',
        entries: [{ label: null, list: `${n('metal')}: 3` }],
      },
      {
        title: 'Forschung',
        entries: [{ label: null, list: `${n('spy')}: 2` }],
      },
    ]);
  });

  it('has no list for a part without any unit, and leaves out a part the spy did not see', () => {
    const body = spy({ ships: {}, def: { rl: 0 } });
    expect(body.sections).toEqual([
      { title: 'Flotte', entries: [{ label: null, list: null }] },
      { title: 'Verteidigung', entries: [{ label: null, list: null }] },
    ]);
  });

  it('shows no held fleets for an empty list', () => {
    expect(titles(spy({ held: [] }))).toEqual([]);
  });

  it('shows the activity of the target: its words, or that there was none, or nothing for an old report', () => {
    expect(spy({ activity: { minutes: 15 } }).sections).toEqual([
      {
        title: 'Aktivität',
        entries: [{ label: null, list: 'Aktivität vor 15 Minuten' }],
      },
    ]);
    expect(spy({ activity: null }).sections).toEqual([
      {
        title: 'Aktivität',
        entries: [
          { label: null, list: 'Keine Aktivität in der letzten Stunde.' },
        ],
      },
    ]);
    expect(titles(spy({}))).toEqual([]);
  });

  it('adds the hint when the report shows no ships and no skulls were lost', () => {
    expect(spy().hint).toBe(true);
    expect(spy({ ships: { lf: 1 } }).hint).toBe(false);
    expect(spy({ lost: true, ships: { lf: 1 } }).hint).toBe(false);
  });

  it('keeps the counter value as it is, text a component escapes', () => {
    expect(spy({ counter: '<1>' }).counter).toBe('<1>');
    expect(spy({ counter: undefined }).counter).toBe('');
  });
});
