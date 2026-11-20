// The words and the rules of the controls of the Runden-Rewind (#235, view G).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Rewind } from '../../core/round-rewind.ts';
import { DELETED_PLAYER } from '../../core/round-report.ts';
import {
  keyStep,
  rewindDuration,
  rewindPage,
  stepIndex,
  stillMotion,
  swipeStep,
} from './round-rewind.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 12);
const MIN = 60_000;

const rewind = (
  over: { played?: number; partial?: boolean; tied?: boolean } = {},
): Rewind => ({
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
      coverage: over.partial ? 'partial' : 'complete',
    },
    ...(over.played === undefined
      ? []
      : [
          {
            kind: 'playtime' as const,
            slot: 6 as const,
            ms: over.played,
            partial: !!over.partial,
          },
        ]),
    {
      kind: 'rank',
      slot: 8,
      number: 3,
      rank: 2,
      of: 3,
      points: 8400,
      tied: !!over.tied,
      winner: { name: 'Lea', points: 9100, you: false },
    },
  ],
});

describe('the words of the cards', () => {
  it('uses the headlines and numbers of the issue for the cards 1, 6 and 8', () => {
    const page = rewindPage(rewind({ played: 760 * MIN }));
    expect(page.heading).toBe('Runden-Rewind · Runde 3');
    expect(page.cards.map((c) => [c.headline, c.figure])).toEqual([
      ['Dein Runden-Rewind', '30 Tage'],
      ['Du warst nicht ständig hier.', '12 h 40'],
      ['Dein Platz in der Chronik.', '2 von 3'],
    ]);
  });

  it('tells the identity of the round and the number of participants', () => {
    const [first] = rewindPage(rewind()).cards;
    expect(first!.lines).toEqual([
      'Runde 3: 1.10.2026 bis 31.10.2026.',
      'Du warst einer von 3 Teilnehmern.',
    ]);
  });

  it('says so when a round has a single participant or ran before the archive', () => {
    const one = rewind({ partial: true });
    (one.cards[0] as { participants: number }).participants = 1;
    expect(rewindPage(one).cards[0]!.lines).toEqual([
      'Runde 3: 1.10.2026 bis 31.10.2026.',
      'Du warst der einzige Teilnehmer.',
      'Die Runde lief schon, als das Archiv eingeführt wurde: ihr früher Verlauf fehlt.',
    ]);
  });

  it('names the method of the play time and what is missing in a partly covered round', () => {
    const lines = rewindPage(rewind({ played: 5 * MIN })).cards[1]!.lines;
    expect(lines[0]).toBe('Deine geschätzte aktive Zeit in dieser Runde.');
    expect(lines[1]).toContain('Methode: Gezählt wird die geschätzte Zeit');
    expect(lines[1]).toContain('Gleichzeitig geöffnete Fenster zählen einmal.');
    expect(lines).toHaveLength(2);
    expect(
      rewindPage(rewind({ played: 5 * MIN, partial: true })).cards[1]!.lines,
    ).toContain('Die Zeit vor Beginn der Erfassung fehlt.');
  });

  it('links card 8 to the full report of the round and no other card', () => {
    const cards = rewindPage(rewind({ played: 0 })).cards;
    expect(cards.map((c) => c.report)).toEqual([null, null, 3]);
  });

  it('tells the place, the points and the winner, or the win, or the tie', () => {
    expect(rewindPage(rewind()).cards[1]!.lines).toEqual([
      'Endplatz nach Punkten: 8.400 Punkte.',
      'Sieger: Lea mit 9.100 Punkten.',
    ]);
    const won = rewind();
    (won.cards[1] as { winner: { you: boolean } }).winner.you = true;
    expect(rewindPage(won).cards[1]!.lines[1]).toBe(
      'Du hast die Runde gewonnen.',
    );
    expect(rewindPage(rewind({ tied: true })).cards[1]!.lines[2]).toContain(
      'genauso viele Punkte',
    );
  });

  it('shows a deleted account as the pseudonym of the archive', () => {
    const r = rewind();
    (r.cards[1] as { winner: { name: string } }).winner.name = DELETED_PLAYER;
    expect(rewindPage(r).cards[1]!.lines[1]).toBe(
      'Sieger: Gelöschter Spieler mit 9.100 Punkten.',
    );
  });

  it('has no card for a round without them', () => {
    expect(rewindPage({ round: 1, cards: [] }).cards).toEqual([]);
  });
});

describe('the active time', () => {
  it('reads hours and minutes from an hour, the words of „Optionen“ below', () => {
    expect(rewindDuration(760 * MIN)).toBe('12 h 40');
    expect(rewindDuration(60 * MIN)).toBe('1 h 00');
    expect(rewindDuration(125 * MIN)).toBe('2 h 05');
    expect(rewindDuration(59.6 * MIN)).toBe('1 h 00');
    expect(rewindDuration(12 * MIN)).toBe('12 Min.');
    expect(rewindDuration(20_000)).toBe('unter 1 Min.');
    expect(rewindDuration(0)).toBe('0 Min.');
  });
});

describe('the keys and the swipe', () => {
  it('turns forward on the right arrow, back on the left, and ignores every other key', () => {
    expect(keyStep('ArrowRight')).toBe(1);
    expect(keyStep('ArrowLeft')).toBe(-1);
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', ' ', 'a', 'Tab'])
      expect(keyStep(key)).toBe(0);
  });

  it('turns on a long sideways swipe, forward to the left and back to the right', () => {
    expect(swipeStep(-60, 5)).toBe(1);
    expect(swipeStep(60, -5)).toBe(-1);
    expect(swipeStep(-48, 0)).toBe(1);
  });

  it('does not turn on a short stroke, a vertical one or a tap', () => {
    expect(swipeStep(-47, 0)).toBe(0);
    expect(swipeStep(-60, 80)).toBe(0);
    expect(swipeStep(-60, 60)).toBe(0);
    expect(swipeStep(0, 0)).toBe(0);
  });

  it('keeps the card inside the cards', () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(1, -1, 3)).toBe(0);
    expect(stepIndex(0, 1, 1)).toBe(0);
  });
});

describe('the motion', () => {
  afterEach(() => vi.unstubAllGlobals());

  const media = (reduced: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: reduced && q === '(prefers-reduced-motion: reduce)',
    }));
  const page = (noAnim: boolean) =>
    vi.stubGlobal('document', {
      documentElement: { classList: { contains: () => noAnim } },
    });

  it('moves when nothing asks for stillness, also where the browser has no media queries', () => {
    expect(stillMotion()).toBe(false);
    media(false);
    page(false);
    expect(stillMotion()).toBe(false);
  });

  it('stands still under prefers-reduced-motion', () => {
    media(true);
    page(false);
    expect(stillMotion()).toBe(true);
  });

  it('stands still when the animations are switched off in „Optionen“', () => {
    media(false);
    page(true);
    expect(stillMotion()).toBe(true);
  });
});
