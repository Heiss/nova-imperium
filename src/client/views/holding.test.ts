// What the views show of holding (#55): the row „Haltezeit“ of the fleet
// form, and every fleet that held as a defender of its own in the battle
// report.
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import { text } from '../../core/text.ts';
import { DEFAULT_UNIVERSE, UNIVERSE_SPECS } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import type { Report } from '../logic/types.ts';
import type { V } from './common.ts';
import { holdRow } from './fleet.ts';
import { messages } from './messages.ts';
import { admin, roundDialog } from './misc.ts';

/** The values of a round at their defaults, the settings of holding on top. */
const rules = (over: Record<string, number | boolean>): RoundRules =>
  ({ number: 1, ...roundDefaults(), ...over }) as RoundRules;

/** The admin panel with the universe settings at `cfg`. */
const panel = (cfg: Record<string, number>): string =>
  admin({
    s: {
      cfg: { ...DEFAULT_UNIVERSE, ...cfg },
      admin: { specs: UNIVERSE_SPECS, endzeit: { minutes: 240, done: false } },
    },
    ui: {},
  } as unknown as V);

describe('who may hold in the dialog „Neue Runde“ and the universe settings (#55, Q2, X1)', () => {
  const OPTIONS = [
    [1, 'Gilde'],
    [2, 'Freunde'],
    [3, 'Gilde und Freunde'],
  ] as const;
  const options = (selected: number) =>
    OPTIONS.map(
      ([v, label]) =>
        `<option value="${v}"${v === selected ? ' selected' : ''}>${label}</option>`,
    ).join('');

  it('is a selection of the dialog, preselected with the current round, after the fields of main', () => {
    for (const allies of [1, 2, 3]) {
      const html = roundDialog(rules({ allies }));
      expect(html).toContain(
        `<p><label for="round-allies">Halten erlaubt für</label> <select id="round-allies">${options(allies)}</select></p>`,
      );
      expect(html.indexOf('id="round-allies"')).toBeGreaterThan(
        html.indexOf('id="round-abandon-lock"'),
      );
      expect(html.indexOf('id="round-allies"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
  });

  it('is a selection in the universe settings, the other rows stay numbers', () => {
    const html = panel({ roundAllies: 1 });
    expect(html).toContain(
      `<tr><td><label for="set_roundAllies">Halten erlaubt für</label></td><td><select id="set_roundAllies" data-setting="roundAllies" data-nokeep>${options(1)}</select></td></tr>`,
    );
    expect(html).toContain(
      '<input type="number" id="set_speed" data-setting="speed" min="1" max="100" value="5" data-nokeep>',
    );
  });
});

describe('held fleets in the spy report in the dialog „Neue Runde“ and the universe settings (#55, owner, 2026-11-17, X1)', () => {
  it('is a level of the Auspex-Lehre of the dialog, preselected with the current round, not in a fieldset', () => {
    for (const heldSpy of [2, 5]) {
      const html = roundDialog(rules({ heldSpy }));
      const field = `<p><label for="round-held-spy">Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre</label> <input type="number" id="round-held-spy" min="0" max="30" step="1" value="${heldSpy}" required> <span class="dim">0 bis 30</span></p>`;
      expect(html).toContain(field);
      // Beside the selection of „Halten erlaubt für“, outside every fieldset.
      expect(html.indexOf(field)).toBeGreaterThan(
        html.indexOf('id="round-allies"'),
      );
      expect(html.indexOf(field)).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
      expect(html.replace(/<fieldset>[\s\S]*?<\/fieldset>/g, '')).toContain(
        field,
      );
    }
  });

  it('is a number field of the universe settings', () => {
    expect(panel({ roundHeldSpy: 4 })).toContain(
      '<tr><td><label for="set_roundHeldSpy">Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre</label></td><td><input type="number" id="set_roundHeldSpy" data-setting="roundHeldSpy" min="0" max="30" value="4" data-nokeep> <span class="dim">0 bis 30</span></td></tr>',
    );
  });
});

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

describe('a spy report of a planet where fleets hold (#55)', () => {
  const view = (held?: unknown) =>
    messages({
      s: {
        me: { readAt: 0 },
        reports: [
          {
            id: 'r1',
            time: 5,
            type: 'spy',
            title: 'Auspex-Bericht',
            name: 'Beta',
            coords: { g: 1, s: 2, p: 6 },
            defName: 'Bert',
            res: { m: 1, c: 2, d: 3 },
            counter: 0,
            lost: false,
            ships: { lf: 2 },
            ...(held === undefined ? {} : { held }),
          },
        ],
      },
      ui: { openRep: {} },
    } as unknown as V);

  it('lists each fleet that holds apart, after the fleet of the planet', () => {
    const html = view([
      { name: 'Anna', ships: { lf: 3, bs: 1 } },
      { name: 'Emil', ships: {} },
    ]);
    expect(html).toContain(
      `<div class="mt"><b>Gehaltene Flotten</b><br>Anna: ${text('lf')!.n}: 3 · ${text('bs')!.n}: 1<br>Emil: <span class="dim">keine</span></div>`,
    );
    expect(html.indexOf('<b>Flotte</b>')).toBeLessThan(
      html.indexOf('Gehaltene Flotten'),
    );
  });

  it('shows no such section without them', () => {
    expect(view()).not.toContain('Gehaltene Flotten');
    expect(view([])).toBe(view());
  });
});
