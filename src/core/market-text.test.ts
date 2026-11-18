// The German words of the marketplace (#171): the issue's own wording and the
// drafts [V], pinned exactly, so a changed word is a changed test.
import { describe, expect, it } from 'vitest';
import type { TradeError } from './market.ts';
import { CLOSED, tradeDone, tradeNote } from './market-text.ts';

const used = { used: 99_000, limit: 100_000 };

describe('the refusals of an exchange (#171)', () => {
  it('says what the issue says when the marketplace is off', () => {
    expect(CLOSED).toBe('Der Marktplatz ist in dieser Runde geschlossen.');
    expect(tradeNote('closed', used, 'c')).toBe(CLOSED);
  });

  it('has a note for every code', () => {
    const codes: TradeError[] = [
      'closed',
      'noPost',
      'resource',
      'amount',
      'poor',
      'full',
      'limit',
      'tiny',
    ];
    expect(codes.map((code) => tradeNote(code, used, 'c'))).toEqual([
      'Der Marktplatz ist in dieser Runde geschlossen.',
      'Auf diesem Planeten fehlt ein Handelsposten.',
      'Diese Rohstoffe lassen sich nicht tauschen.',
      'Bitte eine ganze Menge von mindestens 1 angeben.',
      'So viel hast du auf diesem Planeten nicht.',
      'Das Lager für Psikristall ist voll.',
      'Tageslimit erreicht: Heute kannst du noch 1.000 tauschen.',
      'Für diese Menge bekommst du nichts.',
    ]);
  });

  it('names the resource whose storage is full', () => {
    expect(tradeNote('full', used, 'm')).toBe(
      'Das Lager für Adamant ist voll.',
    );
    expect(tradeNote('full', used, 'd')).toBe(
      'Das Lager für Promethium ist voll.',
    );
  });

  it('says 0 when the limit of the day is used up, never a negative amount', () => {
    expect(tradeNote('limit', { used: 100_000, limit: 100_000 }, 'c')).toBe(
      'Tageslimit erreicht: Heute kannst du noch 0 tauschen.',
    );
    expect(tradeNote('limit', { used: 120_000, limit: 100_000 }, 'c')).toBe(
      'Tageslimit erreicht: Heute kannst du noch 0 tauschen.',
    );
  });
});

describe('what a finished exchange says (#171)', () => {
  it('names both amounts and both resources with German thousands', () => {
    expect(
      tradeDone({ pair: 'mc', given: 1000, got: 450, fee: 50, capped: false }),
    ).toBe('1.000 Adamant gegen 450 Psikristall getauscht.');
    expect(
      tradeDone({
        pair: 'dm',
        given: 1_234_567,
        got: 3_000_000,
        fee: 0,
        capped: false,
      }),
    ).toBe('1.234.567 Promethium gegen 3.000.000 Adamant getauscht.');
  });

  it('says that the storage is full now when the result was capped', () => {
    expect(
      tradeDone({ pair: 'cd', given: 665, got: 299, fee: 33, capped: true }),
    ).toBe(
      '665 Psikristall gegen 299 Promethium getauscht. Das Lager für Promethium ist jetzt voll.',
    );
  });
});
