// The report of a battle of an attack union (#225): every further attacker is
// a block of its own with its losses, found by the E2E spec e2e/union.spec.ts
// (the server wrote `attackers` and `attLoot`, the browser showed the leader
// alone).
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import { reportBody, type BattleBody } from './report-body.ts';
import type { Report } from './types.ts';

const report = (extra: Record<string, unknown> = {}): Report => ({
  id: 'r1',
  time: 5,
  type: 'battle',
  title: 'Kampfbericht',
  name: 'Beta',
  coords: { g: 1, s: 2, p: 6 },
  attName: 'Cora',
  defName: 'Bert',
  rounds: 1,
  winner: 'att',
  attBefore: { lf: 5 },
  attAfter: { lf: 5 },
  defBefore: { probe: 1 },
  defAfter: {},
  attTech: {},
  defTech: {},
  loot: { m: 30, c: 20, d: 10 },
  ...extra,
});

const body = (extra: Record<string, unknown> = {}): BattleBody =>
  reportBody(report(extra)) as BattleBody;

const further = {
  name: 'Emil',
  before: { lf: 3 },
  after: { lf: 2 },
  tech: { weapons: 1, shield: 2, armor: 3 },
  loot: { m: 10, c: 5, d: 0 },
};

describe('a battle report with further attackers', () => {
  it('shows each further attacker as an attacker of its own with its tech and losses', () => {
    const sides = body({ attackers: [further] }).sides;
    expect(sides.map((s) => [s.cls, s.title])).toEqual([
      ['fl-attack', 'Angreifer Cora'],
      ['fl-attack', 'Angreifer Emil'],
      // Both attackers stand before the defender.
      ['good', 'Verteidiger Bert'],
    ]);
    expect(sides[1]).toMatchObject({
      tech: 'Waffen 10% · Schilde 20% · Panzerung 30%',
      units: [
        {
          name: text('lf')!.n,
          before: '3',
          after: '2',
          lost: '1',
          bad: true,
        },
      ],
    });
  });

  it('names the loot share of each attacker', () => {
    const sides = body({
      attackers: [further],
      attLoot: { m: 20, c: 15, d: 10 },
    }).sides;
    expect(sides[0]!.share).toBe('Adamant 20 · Psikristall 15 · Promethium 10');
    expect(sides[1]!.share).toBe('Adamant 10 · Psikristall 5 · Promethium 0');
    expect(sides[2]!.share).toBeNull();
  });

  it('shows no share for an attacker without loot', () => {
    const sides = body({
      winner: 'def',
      loot: undefined,
      attackers: [{ ...further, loot: undefined }],
    }).sides;
    expect(sides.map((s) => s.title)).toContain('Angreifer Emil');
    expect(sides.map((s) => s.share)).toEqual([null, null, null]);
    expect(
      body({ attackers: [{ ...further, loot: { m: 0, c: 0, d: 0 } }] })
        .sides[1]!.share,
    ).toBeNull();
  });

  it('shows the attacker alone as before when nobody joined', () => {
    const alone = body();
    expect(alone.sides.filter((s) => s.cls === 'fl-attack')).toHaveLength(1);
    expect(body({ attackers: [] })).toEqual(alone);
  });
});
