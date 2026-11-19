// The rules of the main planet (#221, owner, 2026-11-16): who can be the
// main planet, the lock after every switch (D3 to D5) and its boundaries.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  MAIN_LOCK_DAYS,
  type MainSwitch,
  canBeMain,
  mainLockEnd,
  mainLocked,
  mainOf,
  mainSwitchError,
} from './main-planet.ts';
import { ROUND_SETTINGS, roundFieldId, roundRefused } from './round.ts';
import { liveSpecs } from './universe.ts';
import type { Planet } from './types.ts';

const NOW = 1_763_300_000_000;
/** The entry of the lock, as the registry holds it. */
const mainLockSetting = ROUND_SETTINGS.filter((s) => s.key === 'roundMainLock');
type Place = Pick<Planet, 'id' | 'owner' | 'kind'>;
const home: Place = { id: 'p1_2_3', owner: 'u_Anna', kind: 'planet' };
const colony: Place = { id: 'p2_5_9', owner: 'u_Anna', kind: 'planet' };
const moon: Place = { id: 'm1_2_3', owner: 'u_Anna', kind: 'moon' };
const foreign: Place = { id: 'p1_4_7', owner: 'u_Bert', kind: 'planet' };

const choice = (over: Partial<MainSwitch>): MainSwitch => ({
  target: colony,
  uid: 'u_Anna',
  current: home.id,
  lockEnd: null,
  now: NOW,
  ...over,
});

describe('the lock length of a round', () => {
  it('is 7 days by default, whole days from 1 to 30', () => {
    expect(MAIN_LOCK_DAYS).toEqual({ min: 1, max: 30, default: 7 });
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
    const refused = (mainLock: unknown) =>
      roundRefused({ mainLock: 7 }, { mainLock }, mainLockSetting).length;
    for (const days of [1, 7, 30]) expect(refused(days)).toBe(0);
    for (const days of [0, 31, -1, 1.5, '7', null, Number.NaN, true])
      expect(refused(days)).toBe(1);
  });

  it('is one entry of the registry, a number field of „Neue Runde“ only, not live (#283)', () => {
    expect(mainLockSetting).toEqual([
      {
        kind: 'number',
        key: 'roundMainLock',
        name: 'mainLock',
        label: 'Sperre nach einem Wechsel des Hauptplaneten (Tage)',
        order: 40,
        min: 1,
        max: 30,
        def: 7,
        refusal:
          'Bitte für die Sperre des Hauptplaneten 1 bis 30 ganze Tage angeben.',
      },
    ]);
    expect(mainLockSetting.map(roundFieldId)).toEqual(['round-main-lock']);
    expect(liveSpecs().map((s) => s.key)).not.toContain('roundMainLock');
  });
});

describe('who can be the main planet', () => {
  it('is an own planet, never a moon or a foreign or missing planet', () => {
    expect(canBeMain(home, 'u_Anna')).toBe(true);
    expect(canBeMain(colony, 'u_Anna')).toBe(true);
    expect(canBeMain(moon, 'u_Anna')).toBe(false);
    expect(canBeMain(foreign, 'u_Anna')).toBe(false);
    expect(canBeMain(null, 'u_Anna')).toBe(false);
    expect(canBeMain(undefined, 'u_Anna')).toBe(false);
  });
});

describe('the lock after a switch', () => {
  it('has no end without a switch', () => {
    expect(mainLockEnd(null, 7)).toBeNull();
    expect(mainLocked(null, NOW)).toBe(false);
  });

  it('never holds without a switch, at any time', () => {
    fc.assert(
      fc.property(fc.integer(), (now) => mainLocked(null, now) === false),
    );
    expect(mainLocked(null, -1)).toBe(false);
  });

  it('ends the set number of days after the switch', () => {
    expect(mainLockEnd(NOW, 7)).toBe(NOW + 7 * DAY_MS);
    expect(mainLockEnd(NOW, 1)).toBe(NOW + DAY_MS);
    expect(mainLockEnd(0, 30)).toBe(30 * DAY_MS);
  });

  it('holds up to the millisecond before its end and is over at the end', () => {
    const end = NOW + 7 * DAY_MS;
    expect(mainLocked(end, NOW)).toBe(true);
    expect(mainLocked(end, end - 1)).toBe(true);
    expect(mainLocked(end, end)).toBe(false);
    expect(mainLocked(end, end + 1)).toBe(false);
  });

  it('holds exactly for the days set, whatever the switch time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4e12 }),
        fc.integer({ min: MAIN_LOCK_DAYS.min, max: MAIN_LOCK_DAYS.max }),
        fc.integer({ min: 0, max: 40 * DAY_MS }),
        (switched, days, after) => {
          const end = mainLockEnd(switched, days);
          expect(mainLocked(end, switched + after)).toBe(after < days * DAY_MS);
        },
      ),
    );
  });
});

describe('the main planet of a player', () => {
  const oldest = (): Place => home;
  const lock = { switched: NOW, days: 7 };

  it('is the first planet without a choice, without a lock', () => {
    expect(mainOf(null, 'u_Anna', { switched: null, days: 7 }, oldest)).toEqual(
      { planet: home, lockEnd: null },
    );
  });

  it('is the chosen planet with the lock of the last switch', () => {
    expect(mainOf(colony, 'u_Anna', lock, oldest)).toEqual({
      planet: colony,
      lockEnd: NOW + 7 * DAY_MS,
    });
    expect(mainOf(home, 'u_Anna', lock, oldest)).toEqual({
      planet: home,
      lockEnd: NOW + 7 * DAY_MS,
    });
  });

  it('falls back to the oldest planet left, without a lock, when the chosen one is not the player’s (D6)', () => {
    for (const lost of [foreign, moon, undefined])
      expect(mainOf(lost, 'u_Anna', lock, oldest)).toEqual({
        planet: home,
        lockEnd: null,
      });
    expect(mainOf(foreign, 'u_Anna', lock, () => null)).toEqual({
      planet: null,
      lockEnd: null,
    });
  });
});

describe('a switch of the main planet', () => {
  it('is possible to an own colony without a lock: the first switch (D5)', () => {
    expect(mainSwitchError(choice({}))).toBeNull();
  });

  it('is refused while the lock of the last switch holds, back to the first planet too (D4)', () => {
    const lockEnd = NOW + DAY_MS;
    expect(mainSwitchError(choice({ lockEnd }))).toBe('locked');
    expect(
      mainSwitchError(
        choice({ target: home, current: colony.id, lockEnd: NOW + 1 }),
      ),
    ).toBe('locked');
  });

  it('is possible again at the end of the lock', () => {
    expect(mainSwitchError(choice({ lockEnd: NOW }))).toBeNull();
    expect(mainSwitchError(choice({ lockEnd: NOW - 1 }))).toBeNull();
    expect(
      mainSwitchError(
        choice({ target: home, current: colony.id, lockEnd: NOW }),
      ),
    ).toBeNull();
  });

  it('refuses a foreign or missing planet, a moon and the current main planet', () => {
    expect(mainSwitchError(choice({ target: foreign }))).toBe('unknown');
    expect(mainSwitchError(choice({ target: null }))).toBe('unknown');
    expect(mainSwitchError(choice({ target: moon }))).toBe('moon');
    expect(mainSwitchError(choice({ target: home }))).toBe('same');
    expect(
      mainSwitchError(choice({ target: colony, current: colony.id })),
    ).toBe('same');
  });

  it('names the planet before the lock: a refused choice never waits for it', () => {
    const lockEnd = NOW + DAY_MS;
    expect(mainSwitchError(choice({ target: foreign, lockEnd }))).toBe(
      'unknown',
    );
    expect(mainSwitchError(choice({ target: moon, lockEnd }))).toBe('moon');
    expect(mainSwitchError(choice({ target: home, lockEnd }))).toBe('same');
  });
});
