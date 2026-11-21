// The component RoundRewind with the cards 2, 3, 4, 5 and 7 (#235, owner
// 2026-11-21): the new cards are drawn like the built ones (one card at a time,
// the same structure, the live line with the stable value, the progress
// segments for eight cards, the state without motion).
import { render } from 'svelte/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rewind } from '../core/round-rewind.ts';
import { rewindPage } from '../client/logic/round-rewind.ts';
import { resetRewind, rewindUi } from '../client/logic/round-rewind.svelte.ts';
import RoundRewind from '../client/views/RoundRewind.svelte';
import { stripComments, textContents } from './markup.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 12);

const FULL: Rewind = {
  round: 3,
  cards: [
    {
      kind: 'identity',
      slot: 1,
      number: 3,
      started: START,
      closed: START + 30 * DAY,
      days: 30,
      participants: 3,
      coverage: 'complete',
    },
    {
      kind: 'economy',
      slot: 2,
      m: 5_000_000,
      c: 2_000_000,
      d: 1_200_000,
      total: 8_200_000,
    },
    { kind: 'focus', slot: 3, focus: 'buildings', percent: 58 },
    {
      kind: 'loss',
      slot: 4,
      day: 17,
      points: 420,
      role: 'defender',
      opponent: 'Karthax',
    },
    { kind: 'return', slot: 5, days: 5, lossDay: 17 },
    { kind: 'playtime', slot: 6, ms: 760 * 60_000, partial: false },
    {
      kind: 'endzeit',
      slot: 7,
      day: 28,
      gift: { ships: 84, cargo: { m: 1e6, c: 1e6, d: 1e6 } },
    },
    {
      kind: 'rank',
      slot: 8,
      number: 3,
      rank: 2,
      of: 3,
      points: 8400,
      tied: false,
      winner: { name: 'Lea', points: 9100, you: false },
    },
  ],
};

const view = (): string =>
  stripComments(
    render(RoundRewind, { props: { page: rewindPage(FULL) } }).body,
  );

beforeEach(resetRewind);
afterEach(() => vi.unstubAllGlobals());

const SHOWN: [number, string, string, string][] = [
  [1, 'economy', 'Du hast eine Wirtschaft aufgebaut.', '8,2 Mio.'],
  [2, 'focus', 'Dein Schwerpunkt: Aufbau.', '58 %'],
  [3, 'loss', 'Dann kam Karthax.', '−420 Flottenpunkte'],
  [4, 'return', 'Du bist zurückgekommen.', '5 Tage'],
  [6, 'endzeit', 'Und dann: die Endzeit.', 'Tag 28'],
];

describe('each new card', () => {
  it.each(SHOWN)(
    'is shown alone at index %i as %s',
    (index, key, headline, figure) => {
      rewindUi.index = index;
      const html = view();
      const text = textContents(html);
      expect(html).toContain(`data-card="${key}"`);
      expect(text).toContain(`h4: ${headline}`);
      expect(text).toContain(`p: ${figure}`);
      // The structure of the built cards: kicker, heading, figure, lines.
      expect(html).toContain('class="rw-kicker"');
      expect(html).toContain('class="rw-figure"');
      expect(html.match(/data-card="/g)).toHaveLength(1);
    },
  );

  it('shows no button to the full report on them, only on the last card', () => {
    rewindUi.index = 1;
    expect(textContents(view()).join('\n')).not.toContain(
      'Vollständigen Bericht',
    );
    rewindUi.index = 7;
    expect(textContents(view())).toContain(
      'button: Vollständigen Bericht öffnen',
    );
  });
});

describe('the story of eight cards', () => {
  it('counts eight cards in the live line and the progress bar', () => {
    const html = view();
    expect(textContents(html)).toContain('p: Karte 1 von 8');
    expect(html.match(/<li/g)?.length).toBeGreaterThanOrEqual(8);
    expect(html).toContain('aria-live="polite"');
  });

  it('tells the stable value of a new card while the play runs', () => {
    rewindUi.playing = true;
    rewindUi.index = 3;
    expect(textContents(view())).toContain(
      'p: Karte 4 von 8: Dann kam Karthax. −420 Flottenpunkte',
    );
  });

  it('stands still without motion also on the new cards', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    rewindUi.index = 2;
    expect(view()).toContain('data-still="true"');
  });
});
