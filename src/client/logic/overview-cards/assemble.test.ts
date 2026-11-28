// The line sources of the overview cards register themselves (#426 part 4).
import { describe, expect, it } from 'vitest';
import { assembleLines } from '../overview-cards.ts';
import type { OverviewLines } from './contract.ts';
import { OVERVIEW_LINES } from './lines.gen.ts';

const source = (
  card: OverviewLines['card'],
  order: number,
  key = `${card}-${order}`,
): OverviewLines => ({
  card,
  order,
  keys: [key],
  lines: () => [{ key, text: key }],
});

const A = 'src/client/logic/overview-cards/a.ts';

describe('the line sources of the overview cards (#426)', () => {
  it('sorts the sources of each card by their order, not by the files', () => {
    const cards = assembleLines([
      ['b', [source('ready', 30), source('attention', 20)]],
      ['a', [source('ready', 10), source('attention', 10)]],
    ]);
    expect(cards.attention.map((s) => s.order)).toEqual([10, 20]);
    expect(cards.ready.map((s) => s.order)).toEqual([10, 30]);
    expect(assembleLines([])).toEqual({ attention: [], ready: [] });
  });

  it('allows one order in two cards, and stops at one order twice in a card', () => {
    expect(() =>
      assembleLines([['a', [source('ready', 10), source('attention', 10)]]]),
    ).not.toThrow();
    expect(() =>
      assembleLines([
        ['a', [source('ready', 10)]],
        ['b', [source('ready', 10)]],
      ]),
    ).toThrow(
      'Overview line ready 10 is defined twice: in src/client/logic/overview-cards/a.ts and in src/client/logic/overview-cards/b.ts.',
    );
  });

  it('stops at a source without an order', () => {
    for (const order of [Number.NaN, Infinity, undefined])
      expect(() =>
        assembleLines([['a', [source('attention', order as number)]]]),
      ).toThrow(
        'Overview line of attention in src/client/logic/overview-cards/a.ts has no order.',
      );
  });

  it('stops at an unknown card, with the file named, instead of dropping it', () => {
    for (const card of ['Achtung', undefined])
      expect(() => assembleLines([['a', [source(card as never, 10)]]])).toThrow(
        `Overview line in ${A} has an unknown card "${card}".`,
      );
  });

  it('stops at a source without lines or without its kinds of keys', () => {
    const noLines = { ...source('ready', 10), lines: undefined };
    for (const bad of [noLines, { ...noLines, lines: 'x' }])
      expect(() =>
        assembleLines([['a', [bad as unknown as OverviewLines]]]),
      ).toThrow(`Overview line of ready in ${A} has no lines.`);
    const noKeys = { ...source('ready', 10), keys: undefined };
    expect(() =>
      assembleLines([['a', [noKeys as unknown as OverviewLines]]]),
    ).toThrow(`Overview line of ready in ${A} names no kinds of keys.`);
  });

  it('stops at a kind of key of two sources in a card, allows it in two cards', () => {
    expect(() =>
      assembleLines([
        ['a', [source('ready', 10, 'fleet')]],
        ['b', [source('ready', 20, 'fleet')]],
      ]),
    ).toThrow(
      `Overview line key ready fleet is defined twice: in ${A} and in src/client/logic/overview-cards/b.ts.`,
    );
    expect(() =>
      assembleLines([
        ['a', [source('ready', 10, 'fleet')]],
        ['b', [source('attention', 10, 'fleet')]],
      ]),
    ).not.toThrow();
  });

  it('holds the five sources of today in their order', () => {
    const cards = assembleLines(OVERVIEW_LINES);
    const files = (card: OverviewLines['card']) =>
      cards[card].map(
        (s) =>
          OVERVIEW_LINES.find(([, list]) =>
            (list as readonly OverviewLines[]).includes(s),
          )![0],
      );
    expect(files('attention')).toEqual(['attacks', 'energy']);
    expect(files('ready')).toEqual(['reward', 'unread', 'idle']);
  });
});
