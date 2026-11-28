// The rules of the vacation mode (#223, owner, 2026-11-16 and 2026-11-17):
// the minimum duration per round (D1), the entry only when nothing runs
// (Q1), the end after the minimum duration, the protection of every place
// of the player (D2, Q2), the actions refused during it and the pause of
// the production (Q2).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { withoutExplain } from '../test/explain.ts';
import {
  HOUR_MS,
  VACATION_HOURS,
  type VacationEntry,
  producesUntil,
  roundSettings,
  vacationEnd,
  vacationEntryError,
  vacationExitError,
  vacationProtects,
  vacationRefuses,
} from './vacation.ts';
import {
  ROUND_SETTINGS,
  roundFieldId,
  roundRefused,
  roundRequest,
  roundValues,
  storedValues,
} from './round.ts';
import { DEFAULT_UNIVERSE, liveSpecs, universeErrors } from './universe.ts';

const NOW = 1_763_300_000_000;

/** The entry of the minimum duration, as the registry holds it (selected by key). */
const SETTINGS = ROUND_SETTINGS.filter((s) => s.key === 'roundVacationHours');

const idle = (over: Partial<VacationEntry> = {}): VacationEntry => ({
  fleets: 0,
  building: false,
  research: false,
  shipyard: false,
  ...over,
});

describe('the minimum duration of a round', () => {
  it('is 48 hours by default (owner, 2026-11-18), whole hours from 1 to 720', () => {
    expect(VACATION_HOURS).toEqual({ min: 1, max: 720, default: 48 });
    expect(HOUR_MS).toBe(60 * 60 * 1000);
  });

  it('is the one entry of the file, as the registry holds it: live, no group, order 150 (#283, #310, X1)', () => {
    expect(withoutExplain(roundSettings)).toEqual([
      {
        kind: 'number',
        key: 'roundVacationHours',
        name: 'vacationHours',
        label: 'Mindestdauer des Urlaubsmodus (Stunden)',
        order: 150,
        min: 1,
        max: 720,
        def: 48,
        live: true,
        refusal:
          'Bitte für die Mindestdauer des Urlaubsmodus 1 bis 720 ganze Stunden angeben.',
      },
    ]);
    expect(SETTINGS).toEqual(roundSettings);
    expect(SETTINGS[0]).not.toHaveProperty('group');
    expect(SETTINGS.map(roundFieldId)).toEqual(['round-vacation-hours']);
  });

  it('refuses a value that is not a whole number of hours from 1 to 720, with its own text', () => {
    const refused = (vacationHours: unknown) =>
      roundRefused({ vacationHours: 24 }, { vacationHours }, SETTINGS);
    for (const hours of [1, 24, 48, 720]) expect(refused(hours)).toEqual([]);
    for (const hours of [0, 721, -1, 1.5, 2.5, '24', null, true, Number.NaN])
      expect(refused(hours), String(hours)).toEqual(SETTINGS);
    // Without a value the round keeps the current one.
    expect(refused(undefined)).toEqual([]);
    expect(SETTINGS[0]!.refusal).toBe(
      'Bitte für die Mindestdauer des Urlaubsmodus 1 bis 720 ganze Stunden angeben.',
    );
  });

  it('is a row of the universe settings with the same label, range and default, checked there (X1)', () => {
    expect(
      withoutExplain(liveSpecs().filter((s) => s.key === 'roundVacationHours')),
    ).toEqual([
      {
        key: 'roundVacationHours',
        label: 'Mindestdauer des Urlaubsmodus (Stunden)',
        min: 1,
        max: 720,
        def: 48,
      },
    ]);
    expect(DEFAULT_UNIVERSE).toMatchObject({ roundVacationHours: 48 });
    const codes = (roundVacationHours: unknown) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, roundVacationHours },
        { g: 1, s: 1, p: 1 },
      ).map((e) => [e.spec.key, e.code]);
    for (const hours of [1, 720]) expect(codes(hours)).toEqual([]);
    for (const hours of [0, 721, 1.5])
      expect(codes(hours)).toEqual([['roundVacationHours', 'range']]);
  });

  it('is stored under its key, 48 without a stored value, and sent as a plain number, not in a group', () => {
    expect(storedValues(() => undefined, SETTINGS)).toEqual({
      vacationHours: 48,
    });
    expect(
      storedValues(
        (k) => (k === 'roundVacationHours' ? 72 : undefined),
        SETTINGS,
      ),
    ).toEqual({ vacationHours: 72 });
    expect(roundRequest({ vacationHours: 24 }, SETTINGS)).toEqual({
      vacationHours: 24,
    });
    expect(
      roundRequest(
        storedValues(() => undefined, SETTINGS),
        SETTINGS,
      ),
    ).toEqual({ vacationHours: 48 });
  });

  it('keeps the current value when the admin sends none and takes the sent one otherwise', () => {
    const current = { vacationHours: 24 };
    expect(roundValues(current, {}, SETTINGS)).toEqual({ vacationHours: 24 });
    expect(roundValues(current, { vacationHours: 1 }, SETTINGS)).toEqual({
      vacationHours: 1,
    });
    expect(roundValues(current, { vacationHours: 720 }, SETTINGS)).toEqual({
      vacationHours: 720,
    });
  });
});

describe('the entry', () => {
  it('is possible when nothing runs', () => {
    expect(vacationEntryError(idle())).toBeNull();
  });

  it('is refused while own fleets fly, something is built, researched or produced', () => {
    expect(vacationEntryError(idle({ fleets: 1 }))).toBe('fleets');
    expect(vacationEntryError(idle({ building: true }))).toBe('building');
    expect(vacationEntryError(idle({ research: true }))).toBe('research');
    expect(vacationEntryError(idle({ shipyard: true }))).toBe('shipyard');
  });

  it('names the fleets first, then the building, the research and the shipyard', () => {
    const all = idle({
      fleets: 2,
      building: true,
      research: true,
      shipyard: true,
    });
    expect(vacationEntryError(all)).toBe('fleets');
    expect(vacationEntryError({ ...all, fleets: 0 })).toBe('building');
    expect(vacationEntryError({ ...all, fleets: 0, building: false })).toBe(
      'research',
    );
  });
});

describe('the end', () => {
  it('is possible at the earliest after the minimum duration', () => {
    expect(vacationEnd(NOW, 24)).toBe(NOW + 24 * HOUR_MS);
    expect(vacationExitError(NOW, 24, NOW)).toBe('early');
    expect(vacationExitError(NOW, 24, NOW + 24 * HOUR_MS - 1)).toBe('early');
    expect(vacationExitError(NOW, 24, NOW + 24 * HOUR_MS)).toBeNull();
    expect(vacationExitError(NOW, 1, NOW + 2 * HOUR_MS)).toBeNull();
  });

  it('is refused without a vacation', () => {
    expect(vacationExitError(null, 24, NOW)).toBe('inactive');
  });

  it('holds exactly before the end of the minimum duration (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2e12 }),
        fc.integer({ min: VACATION_HOURS.min, max: VACATION_HOURS.max }),
        fc.integer({ min: -1e10, max: 1e10 }),
        (start, hours, offset) => {
          const now = vacationEnd(start, hours) + offset;
          expect(vacationExitError(start, hours, now)).toBe(
            offset < 0 ? 'early' : null,
          );
        },
      ),
    );
  });
});

describe('the protection of a player in vacation mode', () => {
  const away = (uid: string) => uid === 'u_Bert';

  it('protects every place of the player from another player', () => {
    expect(vacationProtects({ owner: 'u_Bert' }, 'u_Anna', away)).toBe(true);
  });

  it('protects no place of a player outside the vacation mode', () => {
    expect(vacationProtects({ owner: 'u_Carl' }, 'u_Anna', away)).toBe(false);
  });

  it('never keeps a player from the own places, nor from a free position', () => {
    expect(vacationProtects({ owner: 'u_Bert' }, 'u_Bert', away)).toBe(false);
    expect(vacationProtects(null, 'u_Anna', away)).toBe(false);
    expect(vacationProtects(undefined, 'u_Anna', away)).toBe(false);
  });

  it('asks the vacation only for the owner of the place', () => {
    const asked: string[] = [];
    vacationProtects({ owner: 'u_Bert' }, 'u_Anna', (uid) => {
      asked.push(uid);
      return false;
    });
    expect(asked).toEqual(['u_Bert']);
  });
});

describe('the actions during the vacation mode', () => {
  const GAME = [
    'build',
    'cancelBuild',
    'research',
    'cancelResearch',
    'order',
    'pct',
    'send',
    'recall',
    'scan',
    'claimAchievement',
    'claimDailyReward',
    'startVacation',
    'abandon',
    'jump',
    // The marketplace (#171) is no part of the allow list.
    'trade',
    'anyNewAction',
  ];
  // Owner, 2026-11-18: nothing but the end and the push settings.
  const FREE = ['endVacation', 'pushOptions'];
  const LOCKED = [
    'options',
    'read',
    'delrep',
    'delall',
    'rename',
    'mainPlanet',
    'settings',
    'reset',
    'endzeit',
    'createGuild',
    'sendGuildChat',
    'seeGuildChat',
    'dissolveGuild',
    'requestFriend',
    'answerFriend',
    'cancelFriend',
    'removeFriend',
  ];

  it('refuses every game action, a new one too', () => {
    for (const action of GAME)
      expect(vacationRefuses(action, NOW), action).toBe(true);
  });

  it('allows the end and the push settings only', () => {
    for (const action of FREE)
      expect(vacationRefuses(action, NOW), action).toBe(false);
  });

  it('refuses the options, the messages, renaming, the main planet, the guilds, the friend requests and the admin', () => {
    for (const action of LOCKED)
      expect(vacationRefuses(action, NOW), action).toBe(true);
  });

  it('refuses nothing outside the vacation mode', () => {
    for (const action of [...GAME, ...LOCKED, ...FREE])
      expect(vacationRefuses(action, null), action).toBe(false);
  });
});

describe('the pause of the production', () => {
  it('produces up to the end outside the vacation mode', () => {
    expect(producesUntil(10, 50, null)).toBe(50);
    expect(producesUntil(10, 50, undefined)).toBe(50);
  });

  it('produces up to the start of the vacation, never after it', () => {
    expect(producesUntil(10, 50, 30)).toBe(30);
    expect(producesUntil(10, 50, 50)).toBe(50);
    expect(producesUntil(10, 50, 70)).toBe(50);
  });

  it('produces nothing for a place last settled during the vacation', () => {
    expect(producesUntil(40, 50, 30)).toBe(40);
  });

  it('stays between the last state and the end (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e12 }),
        fc.integer({ min: 0, max: 1e12 }),
        fc.option(fc.integer({ min: 0, max: 2e12 })),
        (from, span, vacation) => {
          const until = from + span;
          const stop = producesUntil(from, until, vacation);
          expect(stop).toBeGreaterThanOrEqual(from);
          expect(stop).toBeLessThanOrEqual(until);
          if (vacation !== null && vacation >= from)
            expect(stop).toBe(Math.min(until, vacation));
        },
      ),
    );
  });
});
