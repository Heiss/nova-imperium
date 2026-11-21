import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_PM_TEXT,
  PM_ERROR_TEXT,
  PM_HISTORY,
  PM_INTERVAL,
  pmExcess,
  pmPair,
  pmTextError,
  pmTooSoon,
  pmUnread,
  REFUSED_TEXT,
  sendError,
  type PmError,
  type SendFacts,
} from './private-messages.ts';

// The pure rules of the private messages (#226).

const facts = (over: Partial<SendFacts> = {}): SendFacts => ({
  sender: 'a',
  recipient: 'b',
  blocked: false,
  friendsOnly: false,
  friends: false,
  ...over,
});

describe('limits', () => {
  it('has the values of the owner (2026-11-21)', () => {
    expect(MAX_PM_TEXT).toBe(1000);
    expect(PM_HISTORY).toBe(500);
    expect(PM_INTERVAL).toBe(2000);
  });

  it('takes 1 to 1,000 characters', () => {
    expect(pmTextError('')).toBe('empty');
    expect(pmTextError('a')).toBeNull();
    expect(pmTextError('a'.repeat(1000))).toBeNull();
    expect(pmTextError('a'.repeat(1001))).toBe('length');
    expect(pmTextError('😀'.repeat(1000))).toBeNull();
  });
});

describe('the rate limit', () => {
  it('lets the first message through and holds a second one for 2 seconds', () => {
    expect(pmTooSoon(5000, undefined)).toBe(false);
    expect(pmTooSoon(5000, 4000)).toBe(true);
    expect(pmTooSoon(5000, 3001)).toBe(true);
    expect(pmTooSoon(5000, 3000)).toBe(false);
  });

  it('is a property of the gap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 0, max: 10_000 }),
        (last, gap) => {
          expect(pmTooSoon(last + gap, last)).toBe(gap < PM_INTERVAL);
        },
      ),
    );
  });
});

describe('who may write to whom', () => {
  it('lets every player write to every player', () => {
    expect(sendError(facts())).toBeNull();
  });

  it('refuses an unknown recipient and oneself', () => {
    expect(sendError(facts({ recipient: null }))).toBe('unknown');
    expect(sendError(facts({ recipient: 'a' }))).toBe('self');
  });

  it('refuses a blocked sender, friends or not', () => {
    expect(sendError(facts({ blocked: true }))).toBe('refused');
    expect(sendError(facts({ blocked: true, friends: true }))).toBe('refused');
  });

  it('refuses a non-friend while the recipient takes friends only, and lets a friend through', () => {
    expect(sendError(facts({ friendsOnly: true }))).toBe('refused');
    expect(sendError(facts({ friendsOnly: true, friends: true }))).toBeNull();
    expect(sendError(facts({ friends: true }))).toBeNull();
  });

  it('gives one code for both refusals, so the sender cannot tell them apart', () => {
    expect(sendError(facts({ blocked: true }))).toBe(
      sendError(facts({ friendsOnly: true })),
    );
  });

  it('is a property of the four facts', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (blocked, friendsOnly, friends) => {
          const error = sendError(facts({ blocked, friendsOnly, friends }));
          expect(error === null).toBe(!(blocked || (friendsOnly && !friends)));
          if (error) expect(error).toBe('refused');
        },
      ),
    );
  });
});

describe('the words', () => {
  it('has a German text for every code, the refusal being the draft', () => {
    const codes: PmError[] = [
      'unknown',
      'self',
      'empty',
      'length',
      'rate',
      'refused',
    ];
    for (const code of codes) expect(PM_ERROR_TEXT[code]).toBeTruthy();
    expect(REFUSED_TEXT).toBe(
      'Dieser Spieler nimmt keine Nachrichten von dir an.',
    );
    expect(PM_ERROR_TEXT.refused).toBe(REFUSED_TEXT);
  });

  it('does not tell the sender that it is blocked', () => {
    expect(REFUSED_TEXT.toLowerCase()).not.toContain('block');
    expect(REFUSED_TEXT.toLowerCase()).not.toContain('freund');
  });

  it('uses the words of the guild chat for an empty, a long and a quick message', () => {
    expect(PM_ERROR_TEXT.empty).toBe('Die Nachricht ist leer.');
    expect(PM_ERROR_TEXT.length).toBe(
      'Die Nachricht darf höchstens 1.000 Zeichen haben.',
    );
    expect(PM_ERROR_TEXT.rate).toBe(
      'Bitte warte kurz vor der nächsten Nachricht.',
    );
  });
});

describe('the cap of a conversation', () => {
  it('drops the oldest beyond 500', () => {
    expect(pmExcess(0)).toBe(0);
    expect(pmExcess(500)).toBe(0);
    expect(pmExcess(501)).toBe(1);
    expect(pmExcess(520)).toBe(20);
  });

  it('is a property: what stays is min(count, 500)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (n) => {
        expect(n - pmExcess(n)).toBe(Math.min(n, PM_HISTORY));
      }),
    );
  });
});

describe('the pair of a conversation', () => {
  it('is the same for both directions', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(pmPair(a, b)).toEqual(pmPair(b, a));
        const [low, high] = pmPair(a, b);
        expect(low <= high).toBe(true);
      }),
    );
  });
});

describe('what is unread', () => {
  const line = (id: number, mine: boolean, read: boolean) => ({
    id,
    mine,
    read,
    time: id,
    text: 'x',
  });
  it('counts received, unread messages only', () => {
    expect(
      pmUnread([
        line(1, false, false),
        line(2, false, true),
        line(3, true, false),
        line(4, true, true),
        line(5, false, false),
      ]),
    ).toBe(2);
    expect(pmUnread([])).toBe(0);
  });
});
