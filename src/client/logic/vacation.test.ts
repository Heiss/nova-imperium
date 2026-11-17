// The box „Urlaubsmodus“ in „Hilfe & Optionen“ and the mark on the
// Sternenkarte (#223): what blocks the entry, the earliest end and the
// button „Urlaubsmodus beenden“, which becomes active after the minimum
// duration (owner, 2026-11-17).
import { describe, expect, it } from 'vitest';
import { HOUR_MS } from '../../core/vacation.ts';
import {
  confirmText,
  vacationEndText,
  vacationHTML,
  vacationMark,
} from './vacation.ts';

const START = new Date(2026, 10, 17, 12, 0).getTime();
const state = (vacation: number | null, vacationHours = 24) => ({
  me: { vacation },
  round: { vacationHours },
});

describe('the box „Urlaubsmodus“ outside of it', () => {
  it('explains the mode and what blocks the entry, and offers to start it', () => {
    const html = vacationHTML(state(null), START);
    expect(html).toBe(
      '<p>Im Urlaubsmodus ruht die Produktion deiner Planeten und Monde, und du kannst nichts bauen, forschen oder Flotten senden. Andere Spieler können keine neuen Flotten zu dir schicken; bereits gestartete kommen noch an. Beenden kannst du ihn frühestens nach 24 Stunden.</p><p>Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs sind und weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet wird.</p><button data-act="startVacation">Urlaubsmodus aktivieren</button>',
    );
  });

  it('names the minimum duration of the round, one hour too', () => {
    expect(vacationHTML(state(null, 48), START)).toContain('nach 48 Stunden.');
    expect(vacationHTML(state(null, 1), START)).toContain('nach 1 Stunde.');
  });
});

describe('the box „Urlaubsmodus“ during it', () => {
  it('shows the earliest end and keeps the button off before it', () => {
    const html = vacationHTML(state(START), START + 24 * HOUR_MS - 1);
    expect(html).toBe(
      `<p>Du bist im Urlaubsmodus.</p><p id="o_vacation_end">Frühestens beendbar am ${vacationEndText(START + 24 * HOUR_MS)}</p><button data-act="endVacation" disabled>Urlaubsmodus beenden</button>`,
    );
    expect(html).not.toContain('startVacation');
  });

  it('turns the button on at the end of the minimum duration', () => {
    for (const now of [START + 24 * HOUR_MS, START + 100 * HOUR_MS])
      expect(vacationHTML(state(START), now)).toContain(
        '<button data-act="endVacation">Urlaubsmodus beenden</button>',
      );
    expect(vacationHTML(state(START, 2), START + 2 * HOUR_MS)).not.toContain(
      'disabled',
    );
  });

  it('writes the end as a date and a clock time', () => {
    expect(vacationEndText(START + 25 * HOUR_MS)).toBe('18.11.2026, 13:00');
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

describe('the mark on the Sternenkarte', () => {
  const players = {
    u_Anna: { name: 'Anna', points: 1, vacation: true },
    u_Bert: { name: 'Bert', points: 1, vacation: false },
    u_Carl: { name: 'Carl', points: 1 },
  };

  it('marks a player in vacation mode with (u)', () => {
    expect(vacationMark(players, 'u_Anna')).toBe(
      ' <span class="dim" title="Urlaubsmodus">(u)</span>',
    );
  });

  it('marks nobody else', () => {
    for (const uid of ['u_Bert', 'u_Carl', 'u_Gone'])
      expect(vacationMark(players, uid)).toBe('');
  });
});
