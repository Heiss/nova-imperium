// The vacation mode in the browser (#223): the box „Urlaubsmodus“ outside of
// it, the question before the start and what the lock screen counts
// (owner, 2026-11-18).
import { describe, expect, it } from 'vitest';
import { HOUR_MS } from '../../core/vacation.ts';
import { dur } from './format.ts';
import {
  confirmText,
  lockLeft,
  lockNote,
  locked,
  vacationIntro,
} from './vacation.ts';

const START = new Date(2026, 10, 17, 12, 0).getTime();
const state = (vacation: number | null, vacationHours = 48) => ({
  me: { vacation },
  round: { vacationHours },
});

describe('the box „Urlaubsmodus“ outside of it', () => {
  it('explains the mode and what blocks the entry', () => {
    expect(vacationIntro(24)).toBe(
      'Im Urlaubsmodus ruht die Produktion deiner Planeten und Monde, und du kannst nichts bauen, forschen oder Flotten senden. Andere Spieler können keine neuen Flotten zu dir schicken; bereits gestartete kommen noch an. Beenden kannst du ihn frühestens nach 24 Stunden.',
    );
  });

  it('names the minimum duration of the round, one hour too', () => {
    expect(vacationIntro(48)).toContain('nach 48 Stunden.');
    expect(vacationIntro(1)).toContain('nach 1 Stunde.');
  });
});

describe('the question before the start', () => {
  it('names the minimum duration', () => {
    expect(confirmText(24)).toBe(
      'Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach 24 Stunden.',
    );
    expect(confirmText(1)).toBe(
      'Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach 1 Stunde.',
    );
  });
});

describe('the lock screen', () => {
  it('is shown to a player in vacation mode only', () => {
    expect(locked({ vacation: START })).toBe(true);
    expect(locked({ vacation: 0 })).toBe(true);
    expect(locked({ vacation: null })).toBe(false);
  });

  it('counts the time until the minimum duration is over, never below 0', () => {
    expect(lockLeft(state(START), START)).toBe(48 * HOUR_MS);
    expect(lockLeft(state(START), START + 48 * HOUR_MS - 1)).toBe(1);
    expect(lockLeft(state(START), START + 48 * HOUR_MS)).toBe(0);
    expect(lockLeft(state(START), START + 100 * HOUR_MS)).toBe(0);
    expect(lockLeft(state(START, 2), START + HOUR_MS)).toBe(HOUR_MS);
    expect(lockLeft(state(null), START)).toBe(0);
    // Without a start there is nothing to wait for, whatever the clock says.
    expect(lockLeft(state(null), 0)).toBe(0);
  });

  it('names the time left in the duration format of the client', () => {
    expect(lockNote(48 * HOUR_MS)).toBe(
      `Du kannst den Urlaubsmodus in ${dur(48 * HOUR_MS)} beenden.`,
    );
    expect(lockNote(3 * HOUR_MS + 5 * 60_000 + 7_000)).toBe(
      'Du kannst den Urlaubsmodus in 3h 05m 07s beenden.',
    );
    expect(lockNote(59_000)).toBe('Du kannst den Urlaubsmodus in 59s beenden.');
  });
});
