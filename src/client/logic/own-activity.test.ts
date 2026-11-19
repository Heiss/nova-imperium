import { describe, expect, it } from 'vitest';
import type { OwnActivity } from '../../core/playtime.ts';
import {
  OWN_ACTIVITY_HELP,
  OWN_ACTIVITY_LOADING,
  OWN_ACTIVITY_FAILED,
  ownActivityHTML,
  playtime,
  utcDate,
  utcMoment,
} from './own-activity.ts';

const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 19, 23, 5, 59);

const data = (over: Partial<OwnActivity> = {}): OwnActivity => ({
  method: 1,
  now: T,
  since: Date.UTC(2026, 10, 12, 7, 3),
  last: Date.UTC(2026, 10, 19, 22, 58),
  round: 3,
  roundMs: 5 * 3600_000 + 7 * 60_000,
  totalMs: 20 * 3600_000,
  days: [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    day: Date.UTC(2026, 10, 19) - i * DAY,
    activeMs: i === 0 ? 90 * 60_000 : i * 60_000,
    actions: i,
  })),
  ...over,
});

describe('playtime', () => {
  it.each([
    [0, '0 Min.'],
    [-5, '0 Min.'],
    [1, 'unter 1 Min.'],
    [29_999, 'unter 1 Min.'],
    [30_000, '1 Min.'],
    [12 * 60_000, '12 Min.'],
    [59 * 60_000 + 29_000, '59 Min.'],
    [59 * 60_000 + 30_000, '1 Std. 00 Min.'],
    [65 * 60_000, '1 Std. 05 Min.'],
    [26 * 3600_000 + 9 * 60_000, '26 Std. 09 Min.'],
  ])('reads %i ms as %s', (ms, text) => {
    expect(playtime(ms)).toBe(text);
  });
});

describe('the UTC dates', () => {
  it('names the day and the moment in UTC', () => {
    expect(utcDate(T)).toBe('19.11.2026');
    expect(utcMoment(T)).toBe('19.11.2026, 23:05 UTC');
    // Just before midnight UTC is still the old day, whatever the time zone of the browser.
    expect(utcDate(Date.UTC(2026, 0, 1) - 1)).toBe('31.12.2025');
  });
});

describe('the box of the options', () => {
  it('shows the sums, the daily table and the explanation', () => {
    const html = ownActivityHTML(data());
    expect(html).toContain(OWN_ACTIVITY_HELP);
    expect(html).toContain('<td>Heute (UTC)</td><td>1 Std. 30 Min.</td>');
    // 90 + 1 + 2 + 3 + 4 + 5 + 6 minutes.
    expect(html).toContain(
      '<td>Letzte 7 Tage (UTC)</td><td>1 Std. 51 Min.</td>',
    );
    expect(html).toContain('<td>Diese Runde</td><td>5 Std. 07 Min.</td>');
    expect(html).toContain('<td>Alle Runden</td><td>20 Std. 00 Min.</td>');
    expect(html).toContain(
      '<td>Zuletzt aktiv</td><td>19.11.2026, 22:58 UTC</td>',
    );
    expect(html).toContain('<td>Heute</td><td>1 Std. 30 Min.</td><td>0</td>');
    expect(html).toContain('<td>18.11.2026</td><td>1 Min.</td><td>1</td>');
    expect(html).toContain('Erfasst seit 12.11.2026, 07:03 UTC.');
    expect(html).toContain('Frühere Schätzungen wurden anders berechnet');
    expect(html).toContain('<th scope="col">Geschätzte aktive Spielzeit</th>');
    expect(html.match(/<tr><td>(Heute|\d\d\.\d\d\.\d{4})<\/td>/g)).toHaveLength(
      7,
    );
  });

  it('says that the recording starts with the next input when nothing is recorded', () => {
    const html = ownActivityHTML(
      data({ since: null, last: null, roundMs: 0, totalMs: 0, days: [] }),
    );
    expect(html).toContain(
      'Die Erfassung beginnt mit deiner nächsten Eingabe.',
    );
    expect(html).toContain('<td>Zuletzt aktiv</td><td>—</td>');
    expect(html).toContain('<td>Heute (UTC)</td><td>0 Min.</td>');
  });

  it('says that the numbers are on their way, and when they fail', () => {
    expect(OWN_ACTIVITY_LOADING).toBe('Wird geladen …');
    expect(OWN_ACTIVITY_FAILED).toBe(
      'Die Angaben sind gerade nicht erreichbar.',
    );
  });
});
