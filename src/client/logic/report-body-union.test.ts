// The report of a battle of an attack union (#225): every further attacker is
// a block of its own with its losses, found by the E2E spec e2e/union.spec.ts
// (the server wrote `attackers` and `attLoot`, the browser showed the leader
// alone).
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import { reportBodyHTML } from './report-body.ts';
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

const further = {
  name: 'Emil',
  before: { lf: 3 },
  after: { lf: 2 },
  tech: { weapons: 1, shield: 2, armor: 3 },
  loot: { m: 10, c: 5, d: 0 },
};

describe('a battle report with further attackers', () => {
  it('shows each further attacker as an attacker of its own with its tech and losses', () => {
    const html = reportBodyHTML(report({ attackers: [further] }))!;
    expect(html).toContain('<b class="fl-attack">Angreifer Cora</b>');
    expect(html).toContain('<b class="fl-attack">Angreifer Emil</b>');
    expect(html).toContain('Waffen 10% · Schilde 20% · Panzerung 30%');
    expect(html).toContain(
      `<tr><td>${text('lf')!.n}</td><td class="n">3</td><td class="n">2</td><td class="n bad">1</td></tr>`,
    );
    // Both attackers stand before the defender.
    expect(html.indexOf('Angreifer Emil')).toBeLessThan(
      html.indexOf('Verteidiger Bert'),
    );
  });

  it('names the loot share of each attacker', () => {
    const html = reportBodyHTML(
      report({
        attackers: [further],
        attLoot: { m: 20, c: 15, d: 10 },
      }),
    )!;
    expect(html).toContain(
      'Erbeutet: Adamant 20 · Psikristall 15 · Promethium 10',
    );
    expect(html).toContain(
      'Erbeutet: Adamant 10 · Psikristall 5 · Promethium 0',
    );
  });

  it('shows no share for an attacker without loot', () => {
    const html = reportBodyHTML(
      report({
        winner: 'def',
        loot: undefined,
        attackers: [{ ...further, loot: undefined }],
      }),
    )!;
    expect(html).toContain('Angreifer Emil');
    expect(html).not.toContain('Erbeutet');
  });

  it('shows the attacker alone as before when nobody joined', () => {
    const alone = reportBodyHTML(report())!;
    expect(alone.match(/class="fl-attack"/g)).toHaveLength(1);
    expect(reportBodyHTML(report({ attackers: [] }))).toBe(alone);
  });
});
