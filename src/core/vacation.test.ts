// The rules of the vacation mode (#223, owner, 2026-11-16 and 2026-11-17):
// the minimum duration per round (D1), the entry only when nothing runs
// (Q1), the end after the minimum duration, the protection of every place
// of the player (D2, Q2), the actions refused during it and the pause of
// the production (Q2).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  HOUR_MS,
  VACATION_HOURS,
  VACATION_SETTING,
  type VacationEntry,
  producesUntil,
  vacationEnd,
  vacationEntryError,
  vacationExitError,
  vacationProtects,
  vacationRefuses,
} from './vacation.ts';
import { ROUND_SETTINGS, roundRefused } from './round.ts';

const NOW = 1_763_300_000_000;

const idle = (over: Partial<VacationEntry> = {}): VacationEntry => ({
  fleets: 0,
  building: false,
  research: false,
  shipyard: false,
  ...over,
});

describe('the minimum duration of a round', () => {
  it('is 24 hours by default, whole hours from 1 to 720', () => {
    expect(VACATION_HOURS).toEqual({ min: 1, max: 720, default: 24 });
    expect(HOUR_MS).toBe(60 * 60 * 1000);
  });

  it('is the setting „vacationHours“ of the registry, live, after the other settings (#283, X1)', () => {
    expect(VACATION_SETTING).toMatchObject({
      kind: 'number',
      key: 'roundVacationHours',
      name: 'vacationHours',
      label: 'Mindestdauer des Urlaubsmodus (Stunden)',
      min: 1,
      max: 720,
      def: 24,
      order: 150,
      live: true,
      refusal:
        'Bitte für die Mindestdauer des Urlaubsmodus 1 bis 720 ganze Stunden angeben.',
    });
    expect(ROUND_SETTINGS).toContain(VACATION_SETTING);
    expect(Math.max(...ROUND_SETTINGS.map((s) => s.order))).toBe(150);
  });

  it('refuses a value that is not a whole number of hours from 1 to 720', () => {
    const refused = (vacationHours: unknown) =>
      roundRefused({ vacationHours: 24 }, { vacationHours }, [
        VACATION_SETTING,
      ]);
    for (const hours of [1, 24, 48, 720]) expect(refused(hours)).toEqual([]);
    for (const hours of [0, 721, -1, 1.5, '24', null, Number.NaN])
      expect(refused(hours)).toEqual([VACATION_SETTING]);
    // Without a value the round keeps the current one.
    expect(refused(undefined)).toEqual([]);
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
    'anyNewAction',
  ];
  const FREE = [
    'options',
    'pushOptions',
    'read',
    'delrep',
    'delall',
    'rename',
    'mainPlanet',
    'endVacation',
    'settings',
    'reset',
    'endzeit',
  ];

  it('refuses every game action, a new one too', () => {
    for (const action of GAME)
      expect(vacationRefuses(action, false, NOW)).toBe(true);
  });

  it('allows the options, the messages, the end and the admin', () => {
    for (const action of FREE)
      expect(vacationRefuses(action, false, NOW)).toBe(false);
  });

  it('allows the guild actions', () => {
    expect(vacationRefuses('sendGuildChat', true, NOW)).toBe(false);
  });

  it('refuses nothing outside the vacation mode', () => {
    for (const action of [...GAME, ...FREE])
      expect(vacationRefuses(action, false, null)).toBe(false);
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
