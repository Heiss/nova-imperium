// The highscore names a planet of each player, never a moon (#53).
import { describe, expect, it } from 'vitest';
import {
  ROUND_SETTINGS,
  type RoundNumber,
  type RoundRules,
  type RoundSetting,
} from '../../core/round.ts';
import { liveSpecs } from '../../core/universe.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import {
  admin,
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
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    mainLock: 7,
    abandonLock: 24,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
    vacationHours: 24,
  };

  it('shows the fields in the fixed order of main (owner, 2026-11-17)', () => {
    const html = roundDialog({ ...rules, guilds: true });
    expect(
      [...html.matchAll(/ id="(round-[a-z-]+)"/g)].map((m) => m[1]),
    ).toEqual([
      'round-achievements',
      'round-daily',
      'round-guilds',
      'round-guilds-note',
      'round-main-lock',
      'round-abandon-lock',
      'round-activity-recent',
      'round-activity-minutes',
      'round-inactive-days',
      'round-long-inactive-days',
      'round-vacation-hours',
    ]);
  });

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
    abandonLock: 24,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
    vacationHours: 24,
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

describe('the lock of a given-up position in the dialog „Neue Runde“ (#224)', () => {
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    guilds: true,
    mainLock: 7,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
    vacationHours: 24,
  };

  it('is a number of hours from 1 to 720, preselected with the current round', () => {
    for (const abandonLock of [24, 48]) {
      const html = roundDialog({ ...rules, abandonLock });
      expect(html).toContain(
        `<label for="round-abandon-lock">Sperre einer aufgegebenen Position (Stunden)</label> <input type="number" id="round-abandon-lock" min="1" max="720" step="1" value="${abandonLock}" required> <span class="dim">1 bis 720</span>`,
      );
      expect(html.indexOf('id="round-main-lock"')).toBeLessThan(
        html.indexOf('id="round-abandon-lock"'),
      );
      expect(html.indexOf('id="round-abandon-lock"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
  });
});

describe('the activity thresholds in the dialog „Neue Runde“ (#229, X1)', () => {
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    guilds: true,
    mainLock: 7,
    abandonLock: 24,
    vacationHours: 24,
  };

  it('stand in one fieldset „Aktivität“, named and ranged as in the universe settings, preselected with the current round, last in the dialog', () => {
    const html = roundDialog({
      ...rules,
      activityRecent: 10,
      activityMinutes: 45,
      inactiveDays: 3,
      longInactiveDays: 21,
    });
    const fields = [
      ['activity-recent', 'Aktivität ohne Minutenangabe (Minuten)', 1, 60, 10],
      [
        'activity-minutes',
        'Aktivität mit Minutenangabe bis (Minuten)',
        1,
        1440,
        45,
      ],
      ['inactive-days', 'Inaktiv ab (Tage)', 1, 365, 3],
      ['long-inactive-days', 'Lange inaktiv ab (Tage)', 1, 365, 21],
    ] as const;
    // Owner, 2026-11-18: a framed group with the heading „Aktivität“.
    const rows = fields.map(
      ([id, label, min, max, value]) =>
        `<label for="round-${id}">${label}</label> <input type="number" id="round-${id}" min="${min}" max="${max}" step="1" value="${value}" required> <span class="dim">${min} bis ${max}</span>`,
    );
    const group = `<fieldset><legend>Aktivität</legend>\n    ${rows.join('<br>\n    ')}\n  </fieldset>`;
    expect(html).toContain(group);
    expect(html.split('<legend>Aktivität</legend>')).toHaveLength(2);
    const at = html.indexOf(group);
    expect(at).toBeGreaterThan(html.indexOf('id="round-abandon-lock"'));
    expect(at).toBeLessThan(html.indexOf('data-act="doReset"'));
  });
});

describe('the minimum duration of the vacation mode in the dialog „Neue Runde“ (#223)', () => {
  const rules = {
    number: 1,
    achievements: true,
    daily: true,
    guilds: true,
    mainLock: 7,
    abandonLock: 24,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
  };

  it('is a number of hours from 1 to 720, preselected with the current round', () => {
    for (const vacationHours of [24, 48]) {
      const html = roundDialog({ ...rules, vacationHours });
      expect(html).toContain(
        `<label for="round-vacation-hours">Mindestdauer des Urlaubsmodus (Stunden)</label> <input type="number" id="round-vacation-hours" min="1" max="720" step="1" value="${vacationHours}" required> <span class="dim">1 bis 720</span>`,
      );
      expect(html.indexOf('id="round-abandon-lock"')).toBeLessThan(
        html.indexOf('id="round-vacation-hours"'),
      );
      expect(html.indexOf('id="round-vacation-hours"')).toBeLessThan(
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
    abandonLock: 24,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
    vacationHours: 24,
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
    abandonLock: 24,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
    vacationHours: 24,
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

describe('a new setting of the round in both places (#283)', () => {
  const hours: RoundNumber<'testHours'> = {
    kind: 'number',
    key: 'roundTestHours',
    name: 'testHours',
    label: 'Testdauer (Stunden)',
    order: 100,
    min: 1,
    max: 720,
    def: 24,
    live: true,
  };
  const allies: RoundNumber<'testAllies'> = {
    kind: 'number',
    key: 'roundTestAllies',
    name: 'testAllies',
    label: 'Halten erlaubt für',
    order: 110,
    min: 1,
    max: 3,
    def: 3,
    live: true,
    choices: [
      { value: 1, label: 'Gilde' },
      { value: 3, label: 'Gilde und Freunde' },
    ],
  };
  const settings: readonly RoundSetting[] = [...ROUND_SETTINGS, hours, allies];
  const round = {
    number: 1,
    achievements: true,
    daily: true,
    guilds: true,
    mainLock: 7,
    abandonLock: 24,
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
    vacationHours: 24,
    testHours: 48,
    testAllies: 1,
  } as RoundRules;

  it('is a field of the dialog „Neue Runde“, preselected with the current round', () => {
    const html = roundDialog(round, settings);
    expect(html).toContain(
      '<p><label for="round-test-hours">Testdauer (Stunden)</label> <input type="number" id="round-test-hours" min="1" max="720" step="1" value="48" required> <span class="dim">1 bis 720</span></p>',
    );
    expect(html).toContain(
      '<p><label for="round-test-allies">Halten erlaubt für</label> <select id="round-test-allies"><option value="1" selected>Gilde</option><option value="3">Gilde und Freunde</option></select></p>',
    );
    expect(html.indexOf('id="round-main-lock"')).toBeLessThan(
      html.indexOf('id="round-test-hours"'),
    );
    expect(html.indexOf('id="round-test-allies"')).toBeLessThan(
      html.indexOf('data-act="doReset"'),
    );
    // The settings of main stay as they were.
    expect(roundDialog(round)).toBe(roundDialog(round, ROUND_SETTINGS));
    expect(roundDialog(round)).not.toContain('round-test');
  });

  it('is a row of the universe settings under its key', () => {
    const html = admin({
      s: {
        cfg: { roundTestHours: 36, roundTestAllies: 3 },
        admin: {
          specs: liveSpecs(settings),
          endzeit: { minutes: 1, done: false },
        },
      },
      ui: {},
    } as unknown as V);
    expect(html).toContain(
      '<tr><td><label for="set_roundTestHours">Testdauer (Stunden)</label></td><td><input type="number" id="set_roundTestHours" data-setting="roundTestHours" min="1" max="720" value="36" data-nokeep> <span class="dim">1 bis 720</span></td></tr>',
    );
    expect(html).toContain(
      '<select id="set_roundTestAllies" data-setting="roundTestAllies" data-nokeep><option value="1">Gilde</option><option value="3" selected>Gilde und Freunde</option></select>',
    );
  });
});
