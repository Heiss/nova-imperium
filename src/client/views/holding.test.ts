// What the views show of holding (#55): the row „Haltezeit“ of the fleet
// form, and every fleet that held as a defender of its own in the battle
// report.
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import type { Report } from '../logic/types.ts';
import type { V } from './common.ts';
import { holdRow } from './fleet.ts';
import { messages } from './messages.ts';

describe('the row „Haltezeit“ of the fleet form', () => {
  const OPTIONS =
    '<option value="0">0 Stunden</option><option value="1" selected>1 Stunde</option><option value="2">2 Stunden</option><option value="4">4 Stunden</option><option value="8">8 Stunden</option><option value="16">16 Stunden</option><option value="32">32 Stunden</option>';

  it('offers the classic holding times, 1 hour preselected, for a Halten', () => {
    expect(holdRow('hold')).toBe(
      `<tr id="t_hold"><td><label for="t_h">Haltezeit</label></td><td><select id="t_h">${OPTIONS}</select></td></tr>`,
    );
  });

  it('is hidden for every other mission', () => {
    for (const m of ['attack', 'transport', 'deploy', 'nope'])
      expect(holdRow(m), m).toMatch(/^<tr id="t_hold" hidden>/);
  });
});

describe('a battle report with fleets that held', () => {
  const report = (held?: unknown): Report => ({
    id: 'r1',
    time: 5,
    type: 'battle',
    title: 'Kampfbericht',
    name: 'Beta',
    coords: { g: 1, s: 2, p: 6 },
    attName: 'Cora',
    defName: 'Bert',
    rounds: 1,
    winner: 'def',
    attBefore: { lf: 1 },
    attAfter: {},
    defBefore: {},
    defAfter: {},
    attTech: {},
    defTech: {},
    ...(held === undefined ? {} : { held }),
  });
  const view = (r: Report) =>
    messages({
      s: { me: { readAt: 0 }, reports: [r] },
      ui: { openRep: {} },
    } as unknown as V);

  it('shows each fleet that held as a defender with its losses', () => {
    const html = view(
      report([
        {
          name: 'Anna',
          before: { bs: 5, lf: 2 },
          after: { bs: 4 },
          tech: { weapons: 1, shield: 2, armor: 3 },
        },
        { name: 'Emil', before: { lf: 1 }, after: { lf: 1 }, tech: {} },
      ]),
    );
    expect(html).toContain('<b class="good">Verteidiger Anna</b>');
    expect(html).toContain('<b class="good">Verteidiger Emil</b>');
    expect(html.indexOf('Verteidiger Bert')).toBeLessThan(
      html.indexOf('Verteidiger Anna'),
    );
    expect(html).toContain(
      `<tr><td>${text('bs')!.n}</td><td class="n">5</td><td class="n">4</td><td class="n bad">1</td></tr>`,
    );
  });

  it('shows the two sides alone without one', () => {
    const html = view(report());
    expect(html.match(/"good">Verteidiger /g)).toHaveLength(1);
    expect(view(report([]))).toBe(html);
  });
});
