// The highscore names a planet of each player, never a moon (#53).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import {
  deleteAccountBox,
  deleteAccountDialog,
  highscore,
  roundDialog,
} from './misc.ts';

describe('highscore', () => {
  it('shows the planet of a player, also when its moon comes first (#53)', () => {
    const at = { g: 1, s: 2, p: 5, temp: 20, owner: 'u_Anna' };
    const s = {
      me: { id: 'u_Anna' },
      players: { u_Anna: { name: 'Anna', points: 7 } },
      galaxy: [
        { ...at, id: 'm1_2_5', kind: 'moon', name: 'Mond' },
        { ...at, id: 'p1_2_5', kind: 'planet', name: 'Heimat' },
      ],
    } as unknown as GameState;
    const html = highscore({ s } as V);
    expect(html).toContain(
      '<td><span class="home">Heimat</span> <span class="lnk" data-act="gto"',
    );
    expect(html).not.toContain('Mond');
  });
});

describe('the dialog „Neue Runde“', () => {
  const box = (html: string): string =>
    /<label><input type="checkbox" id="round-guilds"[^>]*>[^<]*<\/label>/.exec(
      html,
    )?.[0] ?? '';
  const rules = { number: 1, achievements: true, daily: true };

  it('has one box „Gilden (mit Chat)“, preselected with the current round (#191)', () => {
    const on = box(roundDialog({ ...rules, guilds: true }));
    expect(on).toContain('Gilden (mit Chat)');
    expect(on).toMatch(/ checked>/);
    const off = box(roundDialog({ ...rules, guilds: false }));
    expect(off).toContain('Gilden (mit Chat)');
    expect(off).not.toMatch(/checked/);
  });
});

describe('the warning below the box „Gilden (mit Chat)“ (#191)', () => {
  const rules = { number: 1, achievements: true, daily: true };
  // Every new round clears the chats as well (#169 D6), guilds on or off.
  const WARNING =
    'Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.';

  it('stands below the box, always, and the box names it as its description', () => {
    for (const guilds of [true, false]) {
      const html = roundDialog({ ...rules, guilds });
      const box = html.indexOf('id="round-guilds"');
      const note = html.indexOf(
        `<span id="round-guilds-note">${WARNING}</span>`,
      );
      expect(box, String(guilds)).toBeGreaterThan(-1);
      expect(note, String(guilds)).toBeGreaterThan(box);
      expect(html).toMatch(
        /<input type="checkbox" id="round-guilds" aria-describedby="round-guilds-note"/,
      );
      expect(html.indexOf('data-act="doReset"')).toBeGreaterThan(note);
    }
  });
});

describe('„Account löschen“ in a round with or without guilds (#191)', () => {
  const rules = { number: 1, achievements: true, daily: true };
  const on = { ...rules, guilds: true };
  const off = { ...rules, guilds: false };

  it('the box names a led guild only while guilds are on', () => {
    expect(deleteAccountBox(on)).toContain(
      '<p>Dein Konto und deine Spielstände werden dauerhaft gelöscht. Leitest du eine Gilde, wird sie aufgelöst.</p>',
    );
    expect(deleteAccountBox(off)).toContain(
      '<p>Dein Konto und deine Spielstände werden dauerhaft gelöscht.</p>',
    );
    expect(deleteAccountBox(off)).not.toContain('Gilde');
    for (const r of [on, off])
      expect(deleteAccountBox(r)).toContain(
        '<button type="button" class="red" data-act="deleteAccount">Account löschen</button>',
      );
  });

  it('the dialog names a led guild only while guilds are on', () => {
    expect(deleteAccountDialog(on)).toContain(
      '<p>Dein Konto und deine Spielstände werden unwiderruflich gelöscht. Eine von dir geleitete Gilde wird aufgelöst.</p>',
    );
    expect(deleteAccountDialog(off)).toContain(
      '<p>Dein Konto und deine Spielstände werden unwiderruflich gelöscht.</p>',
    );
    expect(deleteAccountDialog(off)).not.toContain('Gilde');
    for (const r of [on, off]) {
      const html = deleteAccountDialog(r);
      expect(html).toMatch(/^<form id="deleteaccountform">/);
      expect(html).toContain(
        '<label for="delete-account-password">Passwort zur Bestätigung</label> <input id="delete-account-password" type="password" autocomplete="current-password" required>',
      );
      expect(html).toContain(
        '<button class="red" type="submit">Account endgültig löschen</button> <button type="button" data-act="closeModal">Abbrechen</button></form>',
      );
    }
  });
});
