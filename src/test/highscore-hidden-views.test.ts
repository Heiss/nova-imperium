// What the views show while the highscore shows nothing (#422, owner,
// 2026-11-26, 182a): no rank in the Sternenkarte, no points of the members
// and no sums in a guild; the „(n)“ stays (179a). Rendered on the server side
// of Svelte as the browser gets it.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { galaxyPage } from '../client/logic/galaxy.ts';
import type { GameState } from '../client/logic/types.ts';
import type { Ui, V } from '../client/views/common.ts';
import Galaxy from '../client/views/Galaxy.svelte';
import { planet, U } from './fixtures.ts';
import { guildsView } from './guilds-view.ts';

/** Anna (u1) at [1:2:5] looks at 1:2, where Bert (u2) has a planet at 6. */
function galaxyOf(shows: number): string {
  const s = {
    cfg: U,
    me: { id: 'u1', probes: 1 },
    round: { highscoreShows: shows },
    players: {
      u1: { name: 'Anna', points: 1000 },
      u2: { name: 'Bert', ...(shows === 2 ? {} : { points: 10 }) },
    },
    galaxy: [
      {
        id: 'p1_2_6',
        kind: 'planet',
        name: 'Bertheim',
        g: 1,
        s: 2,
        p: 6,
        temp: 20,
        owner: 'u2',
      },
    ],
    debris: [],
    protectedOwners: { g: 1, s: 2, owners: ['u2'] },
  } as unknown as GameState;
  const v = {
    s,
    P: planet({ id: 'p1_2_5', g: 1, s: 2, p: 5 }),
    R: { research: {}, rq: null },
    now: 0,
    ui: { gal: 1, sys: 2 } as Ui,
  } as V;
  return render(Galaxy, { props: { page: galaxyPage(v) } }).body;
}

/** The guild page of Outer Rim with the members as the state sends them. */
function guildOf(withPoints: boolean, shown: string | null): string {
  const members = [
    { id: 'u_lea', name: 'Lea', points: 1500 },
    { id: 'u_bo', name: 'Bo', points: 20 },
  ].map(({ points, ...m }) => (withPoints ? { ...m, points } : m));
  const guild = {
    id: 'g1',
    tag: 'OR',
    name: 'Outer Rim',
    html: '',
    members,
    ...(withPoints ? { score: 1520, average: 760 } : {}),
  };
  return guildsView({
    s: {
      me: { id: 'u_x' },
      guilds: {
        directory: [guild],
        own: null,
        management: null,
        ranks: null,
        chat: null,
      },
    },
    ui: { params: { guild: shown } },
  } as unknown as V);
}

describe('the views while the highscore shows nothing (#422, 182a)', () => {
  it('show no rank in the Sternenkarte, and keep the (n)', () => {
    const all = galaxyOf(0);
    expect(all).toContain('(Platz 2)');
    const none = galaxyOf(2);
    expect(none).not.toContain('Platz');
    expect(none).toContain('Bert');
    expect(none).toContain('title="Noobschutz"');
  });

  it('show the guilds and their members without points or sums', () => {
    for (const shown of [null, 'g1']) {
      expect(guildOf(true, shown)).toContain('Punkte');
      const none = guildOf(false, shown);
      expect(none).not.toContain('Punkte');
      expect(none).not.toContain('1.520');
      expect(none).toContain('Outer Rim');
    }
    expect(guildOf(false, 'g1')).toContain('Lea');
  });
});
