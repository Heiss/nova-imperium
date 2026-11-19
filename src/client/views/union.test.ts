// What the fleet view shows of the attack union (#225): the box
// „Verbandsangriff“ with the invitation field for the leader and „Beitreten“
// for everyone, the row „Verband“ of the fleet form, and the buttons of the
// fleet movements.
import { describe, expect, it } from 'vitest';
import { roundDefaults } from '../../test/fixtures.ts';
import type { RoundRules } from '../../core/round.ts';
import type { ClientFleet, GameState, UnionState } from '../logic/types.ts';
import type { V } from './common.ts';
import { fleet } from './fleet.ts';
import { unionBox, unionFormRow } from './union.ts';

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
    expect(unionBox(view([]))).toBe('');
    expect(fleet(view([]))).not.toContain('Verbandsangriff');
  });
  it('shows the union with its counts, fleets and invited, an invitation field for the leader and „Beitreten“', () => {
    const html = unionBox(view([union]));
    expect(html).toContain('<div class="hd">Verbandsangriff</div>');
    expect(html).toContain(
      '<b>Verbandsangriff auf [1:4:8]</b> · Anführer Anna',
    );
    expect(html).toContain('Flotten 1 / 16 · Spieler 1 / 5');
    expect(html).toContain('Flotten: Anna (1)');
    expect(html).toContain('Eingeladen: Bert');
    expect(html).toContain('data-act="inviteUnion" data-id="un&lt;1&gt;"');
    expect(html).toContain('id="un_name_un&lt;1&gt;"');
    expect(html).toContain(
      'data-act="joinUnion" data-id="un&lt;1&gt;">Beitreten</button>',
    );
    expect(html).toContain('class="cd" data-end="100000"');
  });
  it('lets only the leader invite', () => {
    const html = unionBox(view([union], 'u2'));
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
    expect(unionFormRow(view([]))).toBe('');
    expect(fleet(view([]))).not.toContain('id="t_u"');
  });
  it('offers the unions and no union, preselecting the chosen one', () => {
    const html = unionFormRow(view([union]));
    expect(html).toContain('<label for="t_u">Verband</label>');
    expect(html).toContain('<option value="">Kein Verband</option>');
    expect(html).toContain(
      '<option value="un&lt;1&gt;">Anna → [1:4:8], Ankunft ',
    );
    expect(html).not.toContain('selected');
    expect(unionFormRow(view([union], 'u1', { union: 'un<1>' }))).toContain(
      '<option value="un&lt;1&gt;" selected>',
    );
    expect(fleet(view([union]))).toContain('id="t_u"');
  });
});

describe('opening a union from an own Sturmangriff', () => {
  const html = (f: ClientFleet, unions: UnionState[] = []) =>
    unionBox(view(unions, 'u1', {}, [f]));
  it('offers „Angriffsverband eröffnen“ for an own Sturmangriff on its way, in the box, with its target and arrival', () => {
    const page = html(own);
    expect(page).toContain('<div class="hd">Verbandsangriff</div>');
    expect(page).toContain('Sturmangriff auf [1:4:8]');
    expect(page).toContain('class="cd" data-end="100000"');
    expect(page).toContain(
      'data-act="openUnion" data-id="f1">Angriffsverband eröffnen</button>',
    );
    expect(fleet(view([], 'u1', {}, [own]))).toContain('openUnion');
  });
  it('keeps the fleet movements as they were: no button beside the recall', () => {
    const page = fleet(view([], 'u1', {}, [own]));
    expect(page).toContain('data-act="recall" data-id="f1">Rückruf</button>');
    expect(page).not.toContain('Rückruf</button> <button');
  });
  it('offers it for no other fleet and not twice', () => {
    expect(html({ ...own, mission: 'transport' })).toBe('');
    expect(html({ ...own, union: 'f1' })).toBe('');
    expect(html({ ...own, state: 'back' })).toBe('');
    expect(html({ ...own, owner: 'u2' })).toBe('');
  });
  it('says with a union what a recall does', () => {
    expect(html({ ...own, union: 'f1' }, [union])).toContain(
      'Ruft der Anführer seine Flotte zurück, kehren alle Flotten des Verbands um',
    );
    expect(unionBox(view([union]))).toContain('Ruft der Anführer');
  });
});
