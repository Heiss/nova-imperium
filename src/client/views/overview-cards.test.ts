// The component of the phone cards (#189, D5): what its markup carries for the
// CSS (phone-only, the three cards, the bars), for the clock of main.ts (.cd)
// and for main.ts (data-act="nav" on the links).
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import type { Planet } from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import { normalize } from '../../test/markup.ts';
import type { GameState, Report } from '../logic/types.ts';
import type { Ui, V } from './common.ts';
import OverviewCards from './OverviewCards.svelte';

function view(P: Partial<Planet>, over: Partial<GameState> = {}): V {
  const s = {
    cfg: U,
    me: { id: 'u1', readAt: 0 },
    round: { achievements: true, daily: true },
    planet: {},
    fleets: [],
    reports: [] as Report[],
    players: { u2: { name: 'Kain <i>&"\'</i>', points: 1 } },
    ...over,
  } as unknown as GameState;
  return {
    s,
    P: planet(P),
    R: { research: {}, rq: null },
    now: 1000,
    ui: {} as Ui,
  };
}

const html = (v: V): string =>
  normalize(render(OverviewCards, { props: { v } }).body);

it('is a phone-only section with the card „Läuft“ and its empty text', () => {
  const out = html(view({}));
  expect(out).toContain(
    '<section aria-label="Läuft, Achtung und Bereit" class="cards phone-only">',
  );
  expect(out).toContain('<h3>Läuft</h3>');
  expect(out).toContain('Es läuft gerade nichts.');
  expect(out).not.toContain('Achtung</h3>');
  expect(out).not.toContain('Bereit</h3>');
});

it('shows a running order with the countdown of the clock and a labelled bar', () => {
  const out = html(
    view({
      bq: { key: 'metal', lvl: 3, start: 0, end: 5000, cost: [0, 0, 0] },
    }),
  );
  expect(out).toContain(
    '<span class="dim">Gebäude</span> Adamant-Tiefbohrung (Stufe 3)',
  );
  expect(out).toContain('class="cd"');
  expect(out).toContain('data-end="5000"');
  expect(out).toContain('aria-label="Fortschritt Gebäude"');
  expect(out).toContain('max="5000"');
  expect(out).toContain('value="1000"');
});

it('shows the cards „Achtung“ and „Bereit“ with links the navigation handles', () => {
  const out = html(
    view(
      { b: { metal: 10 } },
      {
        fleets: [
          {
            id: 'f1',
            owner: 'u2',
            fromC: { g: 1, s: 3, p: 7 },
            toC: { g: 1, s: 1, p: 5 },
            to: 'p1_1_5',
            mission: 'attack',
            state: 'out',
            arr: 5000,
          },
        ],
        reports: [{ id: 'r', time: 5, type: 'info', title: 'x' }],
      },
    ),
  );
  // A name of a player is text, never markup.
  expect(out).toContain('von Kain &lt;i>&amp;"\'&lt;/i> [1:3:7]');
  expect(out).toContain('<h3>Achtung</h3>');
  expect(out).toContain('<h3>Bereit</h3>');
  expect(out).toContain('1 ungelesene Nachricht');
  for (const target of ['buildings', 'messages']) {
    expect(out).toContain(`href="?view=${target}"`);
    expect(out).toContain(`data-v="${target}"`);
  }
  expect(out).toContain('data-act="nav"');
});

it('shows an empty build queue with a button that selects the place (#189)', () => {
  const v = view({}, {
    idle: ['p1_2_3'],
    galaxy: [
      { id: 'p1_2_3', kind: 'planet', name: 'Kolonie <b>', g: 1, s: 2, p: 3 },
    ],
  } as unknown as Partial<GameState>);
  const out = html(v);
  expect(out).toContain('<h3>Bereit</h3>');
  // A name of a place is text, never markup.
  expect(out).toContain('Bauschleife leer: Kolonie &lt;b> [1:2:3]');
  expect(out).toContain(
    '<button class="small" data-act="selectPlanet" data-id="p1_2_3" type="button">Wechseln</button>',
  );
});
