// What the fleet view (the component Fleet, #118) shows of the attack union (#225): the box
// „Verbandsangriff“ with the invitation field for the leader and „Beitreten“
// for everyone, the row „Verband“ of the fleet form, and the buttons of the
// fleet movements.
import { afterEach, describe, expect, it } from 'vitest';
import { roundDefaults } from '../../test/fixtures.ts';
import { fleetView } from '../../test/fleet-view.ts';
import { normalize } from '../../test/markup.ts';
import type { RoundRules } from '../../core/round.ts';
import type { ClientFleet, GameState, UnionState } from '../logic/types.ts';
import type { V } from './common.ts';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';

/** The fleet view as a browser shows it. */
const fleet = (v: V): string => normalize(fleetView(v));

const union: UnionState = {
  id: 'un<1>',
  leader: 'u1',
  to: 'p1_4_8',
  toC: { g: 1, s: 4, p: 8 },
  arr: 100_000,
  fleets: [{ id: 'f1', owner: 'u1' }],
  invited: ['u2'],
};

const own: ClientFleet = {
  id: 'f1',
  owner: 'u1',
  fromC: { g: 1, s: 1, p: 5 },
  toC: { g: 1, s: 4, p: 8 },
  to: 'p1_4_8',
  mission: 'attack',
  state: 'out',
  arr: 100_000,
  ret: 200_000,
  ships: { lf: 2 },
};

const view = (
  unions: UnionState[],
  me = 'u1',
  extra: Partial<V['ui']> = {},
  fleets: ClientFleet[] = [],
): V =>
  ({
    s: {
      me: { id: me },
      round: { number: 1, ...roundDefaults() } as RoundRules,
      cfg: { galaxies: 3, systems: 100, positions: 15, speed: 1 },
      galaxy: [],
      unions,
      fleets,
      players: { u1: { name: 'Anna' }, u2: { name: 'Bert' } },
    } as unknown as GameState,
    P: { id: 'p1_1_5', g: 1, s: 1, p: 5, ships: { lf: 5 } },
    R: { research: {}, rq: null },
    now: 10_000,
    ui: { fm: 'attack', ft: null, ...extra },
  }) as unknown as V;

describe('the box „Verbandsangriff“', () => {
  it('is not there while no union concerns the player', () => {
    expect(fleet(view([]))).not.toContain('Verbandsangriff');
  });
  it('shows the union with its counts, fleets and invited, an invitation field for the leader and „Beitreten“', () => {
    const html = fleet(view([union]));
    expect(html).toContain('<div class="hd">Verbandsangriff</div>');
    expect(html).toContain(
      '<b>Verbandsangriff auf [1:4:8]</b> · Anführer Anna',
    );
    expect(html).toContain('Flotten 1 / 16 · Spieler 1 / 5');
    expect(html).toContain('Flotten: Anna (1)');
    expect(html).toContain('Eingeladen: Bert');
    expect(html).toContain('data-act="inviteUnion" data-id="un&lt;1>"');
    expect(html).toContain('id="un_name_un&lt;1>"');
    expect(html).toContain(
      'data-act="joinUnion" data-id="un&lt;1>">Beitreten</button>',
    );
    expect(html).toContain('class="cd" data-end="100000"');
  });
  it('lets only the leader invite', () => {
    const html = fleet(view([union], 'u2'));
    expect(html).not.toContain('inviteUnion');
    expect(html).toContain('joinUnion');
  });
  it('is part of the fleet view, also when no ship stands on the planet', () => {
    expect(fleet(view([union]))).toContain('Verbandsangriff auf [1:4:8]');
    const empty = view([union]);
    empty.P.ships = {};
    expect(fleet(empty)).toContain('Verbandsangriff auf [1:4:8]');
  });
});

describe('the row „Verband“ of the fleet form', () => {
  it('is not there without a union', () => {
    expect(fleet(view([]))).not.toContain('id="t_u"');
  });
  it('offers the unions and no union, preselecting the chosen one', () => {
    const html = fleet(view([union]));
    expect(html).toContain('<label for="t_u">Verband</label>');
    expect(html).toContain('<option value="">Kein Verband</option>');
    expect(html).toContain('<option value="un&lt;1>">Anna → [1:4:8], Ankunft ');
    expect(html).not.toContain('<option selected value="un&lt;1>"');
    expect(fleet(view([union], 'u1', { union: 'un<1>' }))).toContain(
      '<option selected value="un&lt;1>">',
    );
    expect(fleet(view([union]))).toContain('id="t_u"');
  });
});

describe('the union chosen after a redraw (#332)', () => {
  afterEach(forgetForms);

  const other = { ...union, id: 'f9' };
  const selected = (html: string): string[] =>
    [
      .../<select id="t_u"[^]*?<\/select>/
        .exec(html)![0]
        .matchAll(/<option selected value="([^"]*)">/g),
    ].map((m) => m[1]!);

  it('shows the union chosen, not the one of the page, and none for the choice of no union', () => {
    const v = (): V => view([union, other], 'u1', { union: 'un<1>' });
    expect(selected(fleet(v()))).toEqual(['un&lt;1>']);
    fleetForm.union = 'f9';
    expect(selected(fleet(v()))).toEqual(['f9']);
    fleetForm.union = '';
    expect(selected(fleet(v()))).toEqual([]);
  });

  it('shows none for a union the player cannot join any more', () => {
    fleetForm.union = 'gone';
    expect(selected(fleet(view([union, other])))).toEqual([]);
  });
});

describe('planning a union in the fleet form (#466, A1a)', () => {
  afterEach(forgetForms);
  /** A foreign planet at the target, so a Sturmangriff fits it. */
  const attack = (over: Partial<V['ui']> = {}): V => {
    const v = view([], 'u1', { ft: { g: 1, s: 4, p: 8 }, ...over });
    v.s.galaxy = [
      {
        id: 'p1_4_8',
        kind: 'planet',
        name: 'Ziel',
        g: 1,
        s: 4,
        p: 8,
        temp: 1,
        owner: 'u2',
      },
    ] as unknown as GameState['galaxy'];
    return v;
  };
  it('offers „Neuen Verband planen“ for a Sturmangriff while the switch is on, and no row for another mission', () => {
    expect(fleet(attack())).toContain(
      '<select id="t_u"><option value="">Kein Verband</option><option value="plan">Neuen Verband planen</option></select>',
    );
    expect(fleet(view([], 'u1', { fm: 'transport' }))).not.toContain(
      'id="t_union_row"',
    );
    const off = attack();
    off.s.round = { ...off.s.round, unionOn: 0 };
    expect(fleet(off)).not.toContain('id="t_union_row"');
  });
  it('drops the plan for another mission and offers it again for a Sturmangriff (review of #473)', () => {
    fleetForm.union = 'plan';
    fleetForm.plan = '2026-11-28T12:30';
    fleetForm.mission = 'transport';
    const html = fleet(attack());
    expect(html).not.toContain('id="t_plan_row"');
    expect(html).not.toContain('id="t_union_row"');
    fleetForm.mission = 'attack';
    expect(fleet(attack())).toContain('id="t_plan_row"');
  });
  it('asks for the arrival of the union, date and time, once it is chosen', () => {
    expect(fleet(attack())).not.toContain('id="t_plan_row"');
    fleetForm.union = 'plan';
    fleetForm.plan = '2026-11-28T12:30';
    const html = fleet(attack());
    expect(html).toContain('<option selected value="plan">');
    expect(html).toContain(
      '<tr id="t_plan_row"><td><label for="t_ux">Ankunft des Verbands</label></td><td><input id="t_ux" type="datetime-local" value="2026-11-28T12:30"></td></tr>',
    );
  });
});

describe('a union in the fleet view (#466)', () => {
  const html = (f: ClientFleet, unions: UnionState[] = []) =>
    fleet(view(unions, 'u1', {}, [f]));
  it('offers no opening from an own Sturmangriff: a union is planned in the fleet form', () => {
    const page = html(own);
    expect(page).not.toContain('Verbandsangriff</div>');
    expect(page).not.toContain('openUnion');
    expect(page).not.toContain('Angriffsverband eröffnen');
  });
  it('keeps the fleet movements as they were: no button beside the recall', () => {
    const page = fleet(view([], 'u1', {}, [own]));
    expect(page).toContain('data-act="recall" data-id="f1">Rückruf</button>');
    expect(page).not.toContain('Rückruf</button> <button');
  });
  it('says with a union how it arrives and what a recall does', () => {
    const page = html({ ...own, union: 'f1' }, [union]);
    expect(page).toContain(
      'Alle Flotten des Verbands kommen zur geplanten Ankunft an',
    );
    expect(page).toContain(
      'Ruft der Anführer seine Flotte zurück, kehren alle Flotten des Verbands um',
    );
  });
});

describe('the name typed to invite (#332)', () => {
  afterEach(forgetForms);

  it('stays in the field of its union over a redraw, and is empty for another', () => {
    const other = { ...union, id: 'f9', leader: 'u1' };
    fleetForm.invite['un<1>'] = 'Bert & Co';
    const html = fleet(view([union, other]));
    expect(html).toMatch(/id="un_name_un&lt;1>"[^>]*value="Bert &amp; Co"/);
    expect(/<input[^>]*id="un_name_f9"[^>]*>/.exec(html)![0]).not.toContain(
      'value',
    );
  });
});
