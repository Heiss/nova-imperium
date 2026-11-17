// „Kolonie aufgeben“ in the overview (#224): offered on an own planet that
// is not the main planet (D3), the confirmation with the coordinates, the
// losses with the moon (Q1), the lock of the round (D2) and the password.
import { describe, expect, it } from 'vitest';
import { abandonDialog, abandonLosses, abandonOffered } from './abandon.ts';
import type { GameState } from './types.ts';

type Target = NonNullable<GameState['planet']>;

const colony = {
  id: 'p2_5_9',
  kind: 'planet',
  owner: 'u_Anna',
  name: 'Kolonie',
  g: 2,
  s: 5,
  p: 9,
  b: { metal: 5, yard: 2 },
  ships: { lf: 3, sc: 1 },
  def: { rl: 4 },
  res: { m: 1234.9, c: 500, d: 7 },
  bq: null,
  sq: [],
} as unknown as Target;

const moon = {
  id: 'm2_5_9',
  kind: 'moon',
  name: 'Luna <b>',
  g: 2,
  s: 5,
  p: 9,
  temp: 0,
  owner: 'u_Anna',
} as const;

const state = (over: Partial<GameState> = {}) =>
  ({
    me: { id: 'u_Anna' },
    mainPlanet: 'p1_2_3',
    galaxy: [],
    round: { abandonLock: 24 },
    ...over,
  }) as unknown as GameState;

describe('the button „Kolonie aufgeben“', () => {
  it('is offered on an own planet that is not the main planet', () => {
    expect(abandonOffered(colony, state())).toBe(true);
    expect(abandonOffered(colony, state({ mainPlanet: null }))).toBe(true);
  });

  it('is not offered on the main planet, a moon or a foreign planet', () => {
    expect(abandonOffered(colony, state({ mainPlanet: 'p2_5_9' }))).toBe(false);
    expect(
      abandonOffered({ ...colony, id: 'm2_5_9', kind: 'moon' }, state()),
    ).toBe(false);
    expect(abandonOffered({ ...colony, owner: 'u_Bert' }, state())).toBe(false);
  });

  it('is offered while orders run: the server names that refusal', () => {
    const busy = {
      ...colony,
      sq: [{ key: 'lf', n: 1, unit: 1000 }],
    } as Target;
    expect(abandonOffered(busy, state())).toBe(true);
  });
});

describe('the losses', () => {
  it('names the buildings, units and stock of the planet', () => {
    expect(abandonLosses(colony, state())).toEqual([
      'Gebäude: 7 Stufen',
      'Schiffe: 4',
      'Verteidigung: 4',
      'Rohstoffe: Adamant 1.234 · Psikristall 500 · Promethium 7',
    ]);
  });

  it('counts nothing on an empty planet, one level in the singular', () => {
    const empty = { ...colony, b: { metal: 1 }, ships: {}, def: {} };
    expect(abandonLosses(empty, state()).slice(0, 3)).toEqual([
      'Gebäude: 1 Stufe',
      'Schiffe: 0',
      'Verteidigung: 0',
    ]);
  });

  it('names the moon of the position, escaped, and no other', () => {
    const other = { ...moon, id: 'm2_5_8', p: 8, name: 'Fremd' };
    expect(abandonLosses(colony, state({ galaxy: [moon, other] })).at(-1)).toBe(
      'der Mond „Luna &lt;b&gt;“ mit allem, was darauf ist',
    );
    expect(abandonLosses(colony, state({ galaxy: [other] }))).toHaveLength(4);
  });
});

describe('the confirmation', () => {
  it('identifies the target, lists the losses, the lock and asks for the password', () => {
    const html = abandonDialog(colony, state({ galaxy: [moon] }));
    expect(html).toBe(
      '<form id="abandonform" data-target="p2_5_9"><p><b>Kolonie aufgeben</b></p>' +
        '<p>Kolonie [2:5:9] wird aufgegeben. Dabei geht verloren:</p>' +
        '<ul><li>Gebäude: 7 Stufen</li><li>Schiffe: 4</li><li>Verteidigung: 4</li>' +
        '<li>Rohstoffe: Adamant 1.234 · Psikristall 500 · Promethium 7</li>' +
        '<li>der Mond „Luna &lt;b&gt;“ mit allem, was darauf ist</li></ul>' +
        '<p>Die Position [2:5:9] ist danach 24 Stunden lang gesperrt.</p>' +
        '<p><b>Diese Aktion kann nicht rückgängig gemacht werden.</b></p>' +
        '<p><label for="abandon-password">Passwort zur Bestätigung</label> <input id="abandon-password" type="password" autocomplete="current-password" required></p>' +
        '<button class="red" type="submit">Kolonie aufgeben</button> <button type="button" data-act="closeModal">Abbrechen</button></form>',
    );
  });

  it('escapes the name and says one hour in the singular', () => {
    const html = abandonDialog(
      { ...colony, name: 'A&B' },
      state({ round: { abandonLock: 1 } as GameState['round'] }),
    );
    expect(html).toContain('<p>A&amp;B [2:5:9] wird aufgegeben.');
    expect(html).toContain('ist danach 1 Stunde lang gesperrt.');
  });
});
