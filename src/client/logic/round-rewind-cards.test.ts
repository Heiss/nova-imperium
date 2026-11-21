// The words of the cards 2, 3, 4, 5 and 7 of the Runden-Rewind (#235, owner
// 2026-11-21): the headlines are the issue's examples, the rest are drafts [V].
import { describe, expect, it } from 'vitest';
import type { Rewind, RewindCard } from '../../core/round-rewind.ts';
import { FOCUS_WORD, million, rewindPage } from './round-rewind.ts';

const page = (card: RewindCard) =>
  rewindPage({ round: 3, cards: [card] } as Rewind).cards[0]!;

describe('card 2, the economy', () => {
  it('shows the sum in millions with a decimal comma and the three resources', () => {
    const c = page({
      kind: 'economy',
      slot: 2,
      m: 5_000_000,
      c: 2_000_000,
      d: 1_200_000,
      total: 8_200_000,
    });
    expect(c.headline).toBe('Du hast eine Wirtschaft aufgebaut.');
    expect(c.figure).toBe('8,2 Mio.');
    expect(c.lines[1]).toBe(
      'Adamant 5.000.000 · Psikristall 2.000.000 · Promethium 1.200.000',
    );
    expect(c.lines[2]).toContain('Gabe des Gottkaisers zählen nicht');
  });

  it('writes a number below a million in full', () => {
    expect(million(999_999)).toBe('999.999');
    expect(million(1_000_000)).toBe('1,0 Mio.');
    expect(million(1_049_999)).toBe('1,0 Mio.');
    expect(million(1_050_000)).toBe('1,1 Mio.');
  });
});

describe('card 3, the focus', () => {
  it('names the focus and its share, with the word of the issue for the buildings', () => {
    const c = page({ kind: 'focus', slot: 3, focus: 'buildings', percent: 58 });
    expect([c.headline, c.figure]).toEqual([
      'Dein Schwerpunkt: Aufbau.',
      '58 %',
    ]);
  });

  it('has a word for every category', () => {
    expect(FOCUS_WORD).toEqual({
      buildings: 'Aufbau',
      research: 'Forschung',
      fleet: 'Flotte',
      defense: 'Verteidigung',
    });
    for (const [focus, word] of Object.entries(FOCUS_WORD))
      expect(
        page({ kind: 'focus', slot: 3, focus: focus as never, percent: 40 })
          .headline,
      ).toBe(`Dein Schwerpunkt: ${word}.`);
  });
});

describe('card 4, the loss', () => {
  const loss = (over: object) =>
    page({
      kind: 'loss',
      slot: 4,
      day: 17,
      points: 420,
      role: 'defender',
      opponent: 'Karthax',
      ...over,
    } as RewindCard);

  it('is the issue example for a defender: „Dann kam Karthax.“ and −420 Flottenpunkte', () => {
    const c = loss({});
    expect([c.headline, c.figure]).toEqual([
      'Dann kam Karthax.',
      '−420 Flottenpunkte',
    ]);
    expect(c.lines[0]).toContain('Tag 17');
    expect(c.lines[1]).toContain('Verteidigungsanlagen zählen nicht');
  });

  it('has its own words for an attacker and for an unnamed opponent', () => {
    expect(loss({ role: 'attacker' }).headline).toBe(
      'Dann traf deine Flotte auf Karthax.',
    );
    expect(loss({ opponent: null }).headline).toBe('Dann kam ein Angriff.');
    expect(loss({ role: 'attacker', opponent: null }).headline).toBe(
      'Dann traf deine Flotte auf einen Gegner.',
    );
  });

  it('writes a large loss with the thousands point', () => {
    expect(loss({ points: 12_345 }).figure).toBe('−12.345 Flottenpunkte');
  });
});

describe('card 5, the return', () => {
  it('is the issue example: „Du bist zurückgekommen.“ and 5 Tage', () => {
    const c = page({ kind: 'return', slot: 5, days: 5, lossDay: 17 });
    expect([c.headline, c.figure]).toEqual([
      'Du bist zurückgekommen.',
      '5 Tage',
    ]);
    expect(c.lines[0]).toContain('Tag 17');
    expect(page({ kind: 'return', slot: 5, days: 1, lossDay: 2 }).figure).toBe(
      '1 Tag',
    );
  });
});

describe('card 7, the Endzeit', () => {
  it('is the issue example: „Und dann: die Endzeit.“ and Tag 28, the gift told apart', () => {
    const c = page({
      kind: 'endzeit',
      slot: 7,
      day: 28,
      gift: { ships: 84, cargo: { m: 1_000_000, c: 1_000_000, d: 1_000_000 } },
    });
    expect([c.headline, c.figure]).toEqual([
      'Und dann: die Endzeit.',
      'Tag 28',
    ]);
    expect(c.lines).toEqual([
      'Der Gottkaiser hat die Endzeit eingeläutet.',
      'Seine Gabe an dich: 84 Schiffe und 3.000.000 Rohstoffe.',
      'Die Gabe kommt von der Spielleitung und steht nicht in deiner Wirtschaft und deinem Schwerpunkt.',
    ]);
  });

  it('says nothing of a gift that did not arrive', () => {
    const c = page({ kind: 'endzeit', slot: 7, day: 3, gift: null });
    expect(c.lines).toEqual(['Der Gottkaiser hat die Endzeit eingeläutet.']);
  });
});

describe('a whole Rewind', () => {
  it('keeps the kinds in the order of the cards as the key of each', () => {
    const cards: RewindCard[] = [
      { kind: 'economy', slot: 2, m: 1, c: 1, d: 1, total: 3 },
      { kind: 'endzeit', slot: 7, day: 1, gift: null },
    ];
    expect(rewindPage({ round: 3, cards }).cards.map((c) => c.key)).toEqual([
      'economy',
      'endzeit',
    ]);
  });
});
