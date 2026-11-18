// The lock screen of the vacation mode (#223, owner, 2026-11-18): the
// notice, the button „Urlaubsmodus beenden“ with its reason in text, the
// sign-out and the account options, and nothing of the game.
import { describe, expect, it } from 'vitest';
import { HOUR_MS } from '../../core/vacation.ts';
import { lockNote } from '../logic/vacation.ts';
import type { GameState } from '../logic/types.ts';
import type { Ui } from './common.ts';
import { lockHTML } from './vacation-lock.ts';

const START = Date.UTC(2026, 10, 17, 12, 0);
const state = (vacation: number | null, guilds = true): GameState =>
  ({
    me: { vacation, pushOff: [] },
    round: { vacationHours: 48, guilds },
  }) as unknown as GameState;
const ui = { webPush: true } as Ui;

describe('the lock screen', () => {
  it('says that the account is in vacation mode, with the title „Urlaubsmodus“', () => {
    const html = lockHTML(state(START), ui, START);
    expect(html).toMatch(/^<h2>Urlaubsmodus<\/h2>/);
    expect(html).toContain('<p>Dein Konto ist im Urlaubsmodus.</p>');
  });

  it('greys the button out while the minimum duration lasts and says why next to it', () => {
    const html = lockHTML(state(START), ui, START + HOUR_MS);
    expect(html).toContain(`<p id="lock-note">${lockNote(47 * HOUR_MS)}</p>`);
    expect(html).toContain(
      '<button data-act="endVacation" disabled aria-describedby="lock-note">Urlaubsmodus beenden</button>',
    );
    expect(html.indexOf('id="lock-note"')).toBeLessThan(
      html.indexOf('data-act="endVacation"'),
    );
  });

  it('turns the button on, without the note, once the minimum duration is over', () => {
    for (const now of [START + 48 * HOUR_MS, START + 99 * HOUR_MS]) {
      const html = lockHTML(state(START), ui, now);
      expect(html).toContain(
        '<button data-act="endVacation">Urlaubsmodus beenden</button>',
      );
      expect(html).not.toContain('lock-note');
      expect(html).not.toContain('disabled');
    }
  });

  it('offers the sign-out and the account options, and nothing of the game', () => {
    const html = lockHTML(state(START), ui, START);
    expect(html).toContain(
      '<button type="button" data-act="logout">Logout</button>',
    );
    for (const part of [
      'Passwort ändern',
      'id="passwordform"',
      'Passkeys',
      'id="passkeyform"',
      'Benachrichtigungen',
      'Browser-Benachrichtigungen',
      'data-act="deleteAccount"',
    ])
      expect(html, part).toContain(part);
    for (const part of [
      'saveopt',
      'Hauptplanet',
      'startVacation',
      'Spähschädel',
      'Problem melden',
      'Regeln dieses Universums',
      'data-act="nav"',
    ])
      expect(html, part).not.toContain(part);
  });

  it('shows the push kinds only on a server with Web Push', () => {
    expect(
      lockHTML(state(START), { webPush: false } as Ui, START),
    ).not.toContain('>Benachrichtigungen<');
    expect(lockHTML(state(START), ui, START)).toContain('>Benachrichtigungen<');
  });
});
