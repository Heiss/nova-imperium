// The highscore names a planet of each player, never a moon (#53).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import {
  admin,
  deleteAccountBox,
  deleteAccountDialog,
  highscore,
  roundDialog,
  roundValues,
} from './misc.ts';
import { DEFAULT_UNIVERSE, UNIVERSE_SPECS } from '../../core/universe.ts';

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
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    mainLock: 7,
    allies: 3,
  };

  it('has one box „Gilden (mit Chat)“, preselected with the current round (#191)', () => {
    const on = box(roundDialog({ ...rules, guilds: true }));
    expect(on).toContain('Gilden (mit Chat)');
    expect(on).toMatch(/ checked>/);
    const off = box(roundDialog({ ...rules, guilds: false }));
    expect(off).toContain('Gilden (mit Chat)');
    expect(off).not.toMatch(/checked/);
  });
});

describe('the lock of the main planet in the dialog „Neue Runde“ (#221)', () => {
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    guilds: true,
    allies: 3,
  };

  it('is a number of days from 1 to 30, preselected with the current round', () => {
    for (const mainLock of [7, 12]) {
      const html = roundDialog({ ...rules, mainLock });
      expect(html).toContain(
        `<label for="round-main-lock">Sperre nach einem Wechsel des Hauptplaneten (Tage)</label> <input type="number" id="round-main-lock" min="1" max="30" step="1" value="${mainLock}" required> <span class="dim">1 bis 30</span>`,
      );
      expect(html.indexOf('id="round-main-lock"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
  });
});

describe('the warning below the box „Gilden (mit Chat)“ (#191)', () => {
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    mainLock: 7,
    allies: 3,
  };
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
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    mainLock: 7,
    allies: 3,
  };
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

describe('the box „Endzeit“ of the tab „Universum“ (#161, #214)', () => {
  const view = (done: boolean): string =>
    admin({
      s: {
        cfg: {},
        admin: { specs: [], endzeit: { minutes: 240, done } },
      },
      ui: {},
    } as unknown as V);

  it('offers the button until the round had its „Endzeit“', () => {
    expect(view(false)).toContain(
      '<button class="red" data-act="endzeit">Endzeit einläuten</button>',
    );
    expect(view(false)).not.toContain('schon eingeläutet');
  });

  it('then says so, with the text of the server (F15)', () => {
    expect(view(true)).toContain(
      '<p>In dieser Runde wurde die Endzeit schon eingeläutet.</p>',
    );
    expect(view(true)).not.toContain('data-act="endzeit"');
  });
});

describe('who may hold (#55, Q2, X1)', () => {
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    guilds: true,
    mainLock: 7,
  };
  const OPTIONS = [
    [1, 'Gilde'],
    [2, 'Freunde'],
    [3, 'Gilde und Freunde'],
  ] as const;
  const options = (selected: number) =>
    OPTIONS.map(
      ([v, label]) =>
        `<option value="${v}"${v === selected ? ' selected' : ''}>${label}</option>`,
    ).join('');

  it('is chosen in „Neue Runde“, preselected with the current round', () => {
    for (const allies of [1, 2, 3]) {
      const html = roundDialog({ ...rules, allies });
      expect(html).toContain(
        `<p><label for="round-allies">Halten erlaubt für</label> <select id="round-allies">${options(allies)}</select></p>`,
      );
      expect(html.indexOf('id="round-allies"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
  });

  it('is read from the dialog with the lock of the main planet', () => {
    const values: Record<string, string> = {
      '#round-main-lock': '12',
      '#round-allies': '2',
    };
    expect(roundValues((sel) => values[sel]!)).toEqual({
      mainLock: 12,
      allies: 2,
    });
  });

  it('is a selection in the universe settings, the others stay numbers', () => {
    const html = admin({
      s: {
        cfg: { ...DEFAULT_UNIVERSE, roundAllies: 1 },
        admin: {
          specs: UNIVERSE_SPECS,
          endzeit: { minutes: 240, done: false },
        },
      },
      ui: {},
    } as unknown as V);
    expect(html).toContain(
      `<tr><td><label for="set_roundAllies">Halten erlaubt für</label></td><td><select id="set_roundAllies" data-setting="roundAllies" data-nokeep>${options(1)}</select></td></tr>`,
    );
    expect(html).toContain(
      '<input type="number" id="set_speed" data-setting="speed" min="1" max="100" value="5" data-nokeep>',
    );
  });
});
