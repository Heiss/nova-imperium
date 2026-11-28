// The highscore, as the component Highscore renders it (#118, bundle 5), names a
// planet of each player, never a moon (#53).
import { describe, expect, it } from 'vitest';
import { explainButton } from '../../test/explain.ts';
import { article } from '../../core/lexicon/articles.ts';
import {
  ROUND_SETTINGS,
  type RoundNumber,
  type RoundRules,
  type RoundSetting,
  roundFieldId,
} from '../../core/round.ts';
import { liveSpecs } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import {
  adminMarkup as admin,
  roundDialogMarkup as roundDialog,
} from '../../test/admin-view.ts';
import { highscoreView } from '../../test/highscore-view.ts';
import { levelView } from '../../test/level-view.ts';
import {
  fieldsetOpen,
  normalize,
  outsideFieldsets,
} from '../../test/markup.ts';
import { optionsView } from '../../test/options-view.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { deleteAccountBox } from './misc.ts';

const highscore = (v: V): string => normalize(highscoreView(v));
/** „Optionen“ as the component Options renders it (#118, bundle 5). */
const help = (v: V): string => normalize(optionsView(v));

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
    const html = highscore({ s, ui: {} } as V);
    expect(html).toContain(
      '<td><span class="home">Heimat</span> <span class="lnk" data-act="gto"',
    );
    expect(html).not.toContain('Mond');
  });
});

describe('the categories of the highscore (#422)', () => {
  const s = {
    me: { id: 'u_Bert' },
    players: {
      u_Anna: {
        name: 'Anna',
        points: 90,
        scores: { economy: 80, military: 1 },
      },
      u_Bert: {
        name: 'Bert',
        points: 40,
        scores: { economy: 5, military: 250 },
      },
    },
    galaxy: [],
    round: { highscoreEconomy: 1, highscoreMilitary: 0 },
  } as unknown as GameState;
  const rows = (html: string): string[] =>
    [
      ...html.matchAll(
        /<tr(?: class="(me)")?><td class="n">(\d+)<\/td><td>(\w+)<\/td><td>-<\/td><td class="n">([\d.]+)<\/td>/g,
      ),
    ].map((m) => `${m[2]} ${m[3]} ${m[4]}${m[1] ? ' me' : ''}`);

  it('shows the total until a category is chosen, with its old note', () => {
    const html = highscore({ s, ui: {} } as V);
    expect(rows(html)).toEqual(['1 Anna 90', '2 Bert 40 me']);
    expect(html).toContain(
      'aria-pressed="true" data-act="highscore" data-cat="total" type="button">Gesamt<',
    );
    expect(html).toContain(
      '<div class="dim">1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Schiffe, Verteidigung).</div>',
    );
  });

  it('ranks by the chosen category and keeps the own row marked', () => {
    const html = highscore({ s, ui: { highscore: 'military' } } as V);
    expect(rows(html)).toEqual(['1 Bert 250 me', '2 Anna 1']);
    expect(html).toContain(
      'aria-pressed="true" data-act="highscore" data-cat="military" type="button">Militär<',
    );
    expect(html).toContain(
      'aria-pressed="false" data-act="highscore" data-cat="total" type="button">Gesamt<',
    );
    expect(html).toContain(
      '<div class="dim">1 Punkt pro Schiff, Verteidigungsanlage und Rakete.</div>',
    );
  });

  it('shows the note of a category counted by resources (168a)', () => {
    const html = highscore({ s, ui: { highscore: 'economy' } } as V);
    expect(rows(html)).toEqual(['1 Anna 80', '2 Bert 5 me']);
    expect(html).toContain(
      '<div class="dim">1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Sonnenreliquiare).</div>',
    );
  });

  it('labels the buttons by the heading', () => {
    const html = highscore({ s, ui: {} } as V);
    expect(html).toMatch(
      /^<h2 id="highscore-h">Highscore<\/h2><div aria-labelledby="highscore-h" class="flex" role="group">/,
    );
  });
});

/** The values of a round at their defaults, a feature's test names its own on top. */
const defaults = (): RoundRules =>
  ({ number: 1, ...roundDefaults() }) as RoundRules;

describe('the dialog „Neue Runde“', () => {
  const box = (html: string): string =>
    /<label><input [^>]*id="round-guilds"[^>]*>[^<]*<\/label>/.exec(
      html,
    )?.[0] ?? '';

  it('shows one field for every setting of the registry, in the order of its numbers (owner, 2026-11-17)', () => {
    const html = roundDialog(defaults());
    // The notes below a field are named after it and the preview line of a
    // group is a line (#237); they are no fields.
    const ids = [...html.matchAll(/ id="(round-[a-z-]+)"/g)]
      .map((m) => m[1])
      .filter(
        (id) =>
          !id!.endsWith('-note') &&
          !id!.startsWith('round-preview-') &&
          !id!.startsWith('round-confirm-'),
      );
    expect(ids).toEqual(ROUND_SETTINGS.map(roundFieldId));
  });

  it('puts the members of a group with a legend in one fieldset of that legend, and every other field outside any', () => {
    const html = roundDialog(defaults());
    const legends = ROUND_SETTINGS.flatMap((s) => s.group?.legend ?? []);
    for (const legend of new Set(legends)) {
      const open = fieldsetOpen(html, legend);
      expect(html.split(open), legend).toHaveLength(2);
      // A legend that repeats the heading of its group is not shown (#357).
      if (open.includes('aria-labelledby'))
        expect(html, legend).not.toContain(`<legend>${legend}</legend>`);
      const fieldset = html.slice(html.indexOf(open)).split('</fieldset>')[0]!;
      const members = ROUND_SETTINGS.filter((s) => s.group?.legend === legend);
      expect(
        [...fieldset.matchAll(/ id="(round-[a-z-]+)"/g)]
          .map((m) => m[1])
          .filter((id) => !id!.startsWith('round-preview-')),
      ).toEqual(members.map(roundFieldId));
    }
    const outside = outsideFieldsets(html);
    for (const s of ROUND_SETTINGS.filter((x) => !x.group?.legend))
      expect(outside, s.key).toContain(normalize(` id="${roundFieldId(s)}"`));
  });

  it('hides the planets per level and the highest level while the colony research is off, with the break before each (#237)', () => {
    const off = roundDialog({ ...defaults(), colonyResearch: 0 });
    const hiddenIds = [
      ...off.matchAll(/<span data-round-field="([a-z-]+)" hidden>/g),
    ].map((m) => m[1]);
    expect(hiddenIds).toEqual([
      'round-colony-per-level',
      'round-colony-max-level',
    ]);
    const on = roundDialog({ ...defaults(), colonyResearch: 1 });
    expect(on).toContain(
      normalize('<span data-round-field="round-colony-per-level">'),
    );
    expect(on).not.toMatch(/data-round-field="[a-z-]+" hidden/);
    // Hidden, the field stays in the page and keeps its value, so it is sent.
    expect(off).toContain('id="round-colony-per-level"');
  });

  it('shows the preview line of the planet limit below its fields, for the current round (#237)', () => {
    const html = roundDialog({
      ...defaults(),
      colonyBase: 6,
      colonyResearch: 1,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    });
    const fieldset = html
      .slice(html.indexOf(fieldsetOpen(html, 'Planetengrenze')))
      .split('</fieldset>')[0]!;
    expect(fieldset).toContain(
      normalize(
        '<p class="dim" id="round-preview-colonies" aria-live="polite">Vorschau: Ohne Forschung: 6 Planeten · Stufe 1: 8 · Stufe 2: 10 · Stufe 3: 12 · Stufe 4: 14.</p>',
      ),
    );
    // A group without a preview gets no line.
    expect(html.match(/id="round-preview-/g)).toHaveLength(1);
  });

  it('repeats the exact planet-limit settings above the button of the reset (#237)', () => {
    const html = roundDialog({
      ...defaults(),
      colonyBase: 6,
      colonyResearch: 1,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    });
    const line = normalize(
      '<p id="round-confirm-colonies" aria-live="polite">Die neue Runde startet mit: Maximale Planeten ohne Forschung: 6 · Kolonieforschung: aktiviert · Zusätzliche Planeten je Forschungsstufe: 2 · Maximale Forschungsstufe: 4.</p>',
    );
    expect(html).toContain(line);
    // Outside the fieldset, between the fields and the buttons.
    expect(html.indexOf(line)).toBeGreaterThan(html.lastIndexOf('</fieldset>'));
    expect(html.indexOf(line)).toBeLessThan(html.indexOf('data-act="doReset"'));
  });

  it('preselects the planet limit with what a new round starts with where the running round has no value of its own (#237)', () => {
    const base = (html: string): string =>
      /<input [^>]*id="round-colony-base"[^>]*>/.exec(html)?.[0] ?? '';
    const running = { ...defaults(), colonyBase: 0 };
    expect(base(roundDialog(running))).toContain('value="0"');
    expect(
      base(roundDialog(running, ROUND_SETTINGS, { colonyBase: 6 })),
    ).toContain('value="6"');
    // The preview line follows what is preselected.
    expect(roundDialog(running, ROUND_SETTINGS, { colonyBase: 6 })).toContain(
      normalize('Vorschau: 6 Planeten'),
    );
  });

  it('has one box „Gilden (mit Chat)“, preselected with the current round (#191)', () => {
    const on = box(roundDialog({ ...defaults(), guilds: true }));
    expect(on).toContain('Gilden (mit Chat)');
    expect(on).toMatch(/ checked[ >]/);
    const off = box(roundDialog({ ...defaults(), guilds: false }));
    expect(off).toContain('Gilden (mit Chat)');
    expect(off).not.toMatch(/checked/);
  });
});

describe('the lock of the main planet in the dialog „Neue Runde“ (#221)', () => {
  it('is a number of days from 1 to 30, preselected with the current round', () => {
    for (const mainLock of [7, 12]) {
      const html = roundDialog({ ...defaults(), mainLock });
      expect(html).toContain(
        normalize(
          `<label for="round-main-lock">Sperre nach einem Wechsel des Hauptplaneten (Tage)</label> <input type="number" id="round-main-lock" min="1" max="30" step="1" value="${mainLock}" required> <span class="dim">1 bis 30</span>`,
        ),
      );
      expect(html.indexOf('id="round-main-lock"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
  });
});

describe('the lock of a given-up position in the dialog „Neue Runde“ (#224)', () => {
  it('is a number of hours from 1 to 720, preselected with the current round', () => {
    for (const abandonLock of [24, 48]) {
      const html = roundDialog({ ...defaults(), abandonLock });
      expect(html).toContain(
        normalize(
          `<label for="round-abandon-lock">Sperre einer aufgegebenen Position (Stunden)</label> <input type="number" id="round-abandon-lock" min="1" max="720" step="1" value="${abandonLock}" required> <span class="dim">1 bis 720</span>`,
        ),
      );
      expect(html.indexOf('id="round-abandon-lock"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
  });
});

describe('the minimum duration of the vacation mode in the dialog „Neue Runde“ (#223)', () => {
  it('is a number of hours from 1 to 720, preselected with the current round, outside every fieldset', () => {
    for (const vacationHours of [24, 48]) {
      const html = roundDialog({ ...defaults(), vacationHours });
      expect(html).toContain(
        normalize(
          `<label for="round-vacation-hours">Mindestdauer des Urlaubsmodus (Stunden)</label> <input type="number" id="round-vacation-hours" min="1" max="720" step="1" value="${vacationHours}" required> <span class="dim">1 bis 720</span>`,
        ),
      );
      expect(html.split('id="round-vacation-hours"')).toHaveLength(2);
      expect(html.indexOf('id="round-abandon-lock"')).toBeLessThan(
        html.indexOf('id="round-vacation-hours"'),
      );
      expect(html.indexOf('id="round-recognition-counts"')).toBeLessThan(
        html.indexOf('id="round-vacation-hours"'),
      );
      expect(html.indexOf('id="round-vacation-hours"')).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
      const outside = outsideFieldsets(html);
      expect(outside).toContain('id="round-vacation-hours"');
    }
  });
});

describe('the activity thresholds in the dialog „Neue Runde“ (#229, X1)', () => {
  it('stand in one fieldset „Aktivität“, named and ranged as in the universe settings, preselected with the current round', () => {
    const html = roundDialog({
      ...defaults(),
      activityRecent: 10,
      activityMinutes: 45,
      inactiveDays: 3,
      longInactiveDays: 21,
    });
    const fields = [
      [
        'activity-recent',
        'roundActivityRecent',
        'Aktivität ohne Minutenangabe (Minuten)',
        1,
        60,
        10,
      ],
      [
        'activity-minutes',
        'roundActivityMinutes',
        'Aktivität mit Minutenangabe bis (Minuten)',
        1,
        1440,
        45,
      ],
      ['inactive-days', 'roundInactiveDays', 'Inaktiv ab (Tage)', 1, 365, 3],
      [
        'long-inactive-days',
        'roundLongInactiveDays',
        'Lange inaktiv ab (Tage)',
        1,
        365,
        21,
      ],
    ] as const;
    // Owner, 2026-11-18: a framed group with the heading „Aktivität“; the
    // group's heading names it since #357 (owner, 2026-11-22: no legend that
    // repeats it).
    const rows = fields.map(
      ([id, key, label, min, max, value]) =>
        `<label for="round-${id}">${label}</label> <input type="number" id="round-${id}" min="${min}" max="${max}" step="1" value="${value}" required> <span class="dim">${min} bis ${max}</span> ${explainButton(key, 'r')}`,
    );
    const open = fieldsetOpen(html, 'Aktivität');
    expect(open).toMatch(/aria-labelledby/);
    const group = normalize(
      `${open}\n    ${rows.join('<br>\n    ')}\n  </fieldset>`,
    );
    expect(html).toContain(group);
    expect(html.split(open)).toHaveLength(2);
    expect(html).not.toContain('<legend>Aktivität</legend>');
    expect(html.indexOf(group)).toBeLessThan(
      html.indexOf('data-act="doReset"'),
    );
  });
});

describe('the thresholds of foreign fleets in the dialog „Neue Runde“ (#228, X1)', () => {
  it('are levels from 0 to 100, named as in the universe settings, preselected with the current round, in one fieldset with the legend of the owner (2026-11-18)', () => {
    const html = roundDialog({
      ...defaults(),
      recognitionTotal: 1,
      recognitionTypes: 5,
      recognitionCounts: 9,
    });
    for (const [part, label, value] of [
      ['total', 'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre', 1],
      ['types', 'Fremde Flotten: Schiffstypen ab Auspex-Lehre', 5],
      ['counts', 'Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre', 9],
    ] as const) {
      expect(html).toContain(
        normalize(
          `<label for="round-recognition-${part}">${label}</label> <input type="number" id="round-recognition-${part}" min="0" max="100" step="1" value="${value}" required> <span class="dim">0 bis 100</span>`,
        ),
      );
      expect(html.indexOf(`id="round-recognition-${part}"`)).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
    const open = fieldsetOpen(html, 'Fremde Flotten erkennen');
    expect(open).toMatch(/aria-labelledby/);
    expect(html.split(open)).toHaveLength(2);
    expect(html).not.toContain('<legend>Fremde Flotten erkennen</legend>');
    const group = html.slice(html.indexOf(open)).split('</fieldset>')[0]!;
    expect(group.match(/<input /g)).toHaveLength(3);
    for (const part of ['total', 'types', 'counts'])
      expect(group).toContain(normalize(`id="round-recognition-${part}"`));
  });
});

describe('the demolition in the dialog „Neue Runde“ (#202, X1)', () => {
  it('are a refund factor from -100 to 100 and a time from 1 to 200, named as in the universe settings, preselected with the current round, in one fieldset with the legend of the owner (2026-11-18)', () => {
    const html = roundDialog({
      ...defaults(),
      demolitionRefund: -40,
      demolitionTime: 120,
    });
    for (const [part, label, min, max, value] of [
      ['refund', 'Rückbau-Erstattung (%)', -100, 100, -40],
      ['time', 'Rückbau-Dauer (% der Bauzeit)', 1, 200, 120],
    ] as const) {
      expect(html).toContain(
        normalize(
          `<label for="round-demolition-${part}">${label}</label> <input type="number" id="round-demolition-${part}" min="${min}" max="${max}" step="1" value="${value}" required> <span class="dim">${min} bis ${max}</span>`,
        ),
      );
      expect(html.indexOf(`id="round-demolition-${part}"`)).toBeLessThan(
        html.indexOf('data-act="doReset"'),
      );
    }
    const open = '<fieldset><legend>Rückbau</legend>';
    expect(html.split(open)).toHaveLength(2);
    const group = html.slice(html.indexOf(open)).split('</fieldset>')[0]!;
    expect(group.match(/<input /g)).toHaveLength(2);
    for (const part of ['refund', 'time'])
      expect(group).toContain(normalize(`id="round-demolition-${part}"`));
  });

  it('are preselected with the defaults +50 % and 50 %', () => {
    const html = roundDialog(defaults());
    expect(html).toContain(
      normalize(
        '<input type="number" id="round-demolition-refund" min="-100" max="100" step="1" value="50" required>',
      ),
    );
    expect(html).toContain(
      normalize(
        '<input type="number" id="round-demolition-time" min="1" max="200" step="1" value="50" required>',
      ),
    );
  });
});

describe('the warning below the box „Gilden (mit Chat)“ (#191)', () => {
  // Every new round clears the chats as well (#169 D6), guilds on or off.
  const WARNING =
    'Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.';

  it('stands below the box, always, and the box names it as its description', () => {
    for (const guilds of [true, false]) {
      const html = roundDialog({ ...defaults(), guilds });
      const box = html.indexOf('id="round-guilds"');
      const note = html.indexOf(
        `<span id="round-guilds-note">${WARNING}</span>`,
      );
      expect(box, String(guilds)).toBeGreaterThan(-1);
      expect(note, String(guilds)).toBeGreaterThan(box);
      expect(html).toMatch(
        /<input aria-describedby="round-guilds-note"[^>]* id="round-guilds"/,
      );
      expect(html.indexOf('data-act="doReset"')).toBeGreaterThan(note);
    }
  });
});

describe('the box „Account löschen“ in a round with or without guilds (#191)', () => {
  const on = { ...defaults(), guilds: true };
  const off = { ...defaults(), guilds: false };

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
});

describe('the link of the last invitation (#239)', () => {
  const view = (lastLink?: string): string =>
    admin({
      s: {
        cfg: {},
        admin: { specs: [], endzeit: { minutes: 240, done: false } },
      },
      ui: { lastLink },
    } as unknown as V);

  it('shows the link of the server and is not kept over a refresh', () => {
    expect(view('https://x/#invite=new')).toContain(
      normalize(
        '<input id="inv_link" class="wide" readonly value="https://x/#invite=new" aria-label="Einladungslink" data-nokeep>',
      ),
    );
  });

  it('shows no field before the first invitation', () => {
    expect(view()).not.toContain('inv_link');
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
      normalize(
        '<button class="red" data-act="endzeit">Endzeit einläuten</button>',
      ),
    );
    expect(view(false)).not.toContain('schon eingeläutet');
  });

  it('then says so, with the text of the server (F15)', () => {
    expect(view(true)).toContain(
      normalize('<p>In dieser Runde wurde die Endzeit schon eingeläutet.</p>'),
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
    label: 'Verbündete für Halten und Verband',
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
    ...defaults(),
    testHours: 48,
    testAllies: 1,
  } as RoundRules;

  it('is a field of the dialog „Neue Runde“, preselected with the current round', () => {
    const html = roundDialog(round, settings);
    expect(html).toContain(
      normalize(
        `<p><label for="round-test-hours">Testdauer (Stunden)</label> <input type="number" id="round-test-hours" min="1" max="720" step="1" value="48" required> <span class="dim">1 bis 720</span> ${explainButton('roundTestHours', 'r')}</p>`,
      ),
    );
    expect(html).toContain(
      normalize(
        `<p><label for="round-test-allies">Verbündete für Halten und Verband</label> <select id="round-test-allies"><option value="1" selected>Gilde</option><option value="3">Gilde und Freunde</option></select> ${explainButton('roundTestAllies', 'r')}</p>`,
      ),
    );
    // The new ones have the highest numbers, so they stand after the registry.
    expect(
      html.indexOf(` id="${roundFieldId(ROUND_SETTINGS.at(-1)!)}"`),
    ).toBeLessThan(html.indexOf('id="round-test-hours"'));
    expect(html.indexOf('id="round-test-allies"')).toBeLessThan(
      html.indexOf('data-act="doReset"'),
    );
    // The settings of the registry stay as they were.
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
      normalize(
        `<tr><td><label for="set_roundTestHours">Testdauer (Stunden)</label> ${explainButton('roundTestHours', 'u')}</td><td><input type="number" id="set_roundTestHours" data-setting="roundTestHours" min="1" max="720" value="36" data-nokeep> <span class="dim">1 bis 720</span></td></tr>`,
      ),
    );
    expect(html).toContain(
      normalize(
        '<select id="set_roundTestAllies" data-setting="roundTestAllies" data-nokeep><option value="1">Gilde</option><option value="3" selected>Gilde und Freunde</option></select>',
      ),
    );
  });
});

describe('the mark of a live setting in „Universum“ (#441, 235b)', () => {
  it('stands next to its row, and nowhere for a row without one', () => {
    const marked = liveSpecs(ROUND_SETTINGS).map((x, i) =>
      i === 0 ? { ...x, mark: 'new' as const } : x,
    );
    const html = admin({
      s: {
        cfg: Object.fromEntries(marked.map((x) => [x.key, x.def])),
        admin: { specs: marked, endzeit: { minutes: 1, done: false } },
      },
      ui: {},
    } as unknown as V);
    expect(html).toContain(
      normalize(
        `<label for="set_${marked[0]!.key}">${marked[0]!.label}</label><span class="mark mark-new">neu</span>`,
      ),
    );
    expect(html.match(/class="mark /g)).toHaveLength(1);
    // The row „Voreinstellung“ stands in „Universum“.
    expect(html).toContain('data-presets="universe"');
  });
});

describe('the option „Stufenübersicht“ in „Optionen“ (#187)', () => {
  const page = (levelTable?: string): string => {
    const v = levelView({}, {}, [], { levelTable, probes: 1, pushOff: [] });
    v.s.round = roundDefaults() as unknown as GameState['round'];
    v.s.homePlanet = 'p';
    v.ui = { animations: true, view: 'help' } as unknown as V['ui'];
    return help(v);
  };

  it('is a choice of the three modes beside the one of the „?“', () => {
    const html = page('always');
    expect(html).toContain(
      '<label for="o_levels">Stufenübersicht:</label> <select id="o_levels">' +
        '<option selected value="always">Immer anzeigen</option>' +
        '<option value="icon">Als ▤-Symbol</option>' +
        '<option value="hidden">Ausblenden</option></select>',
    );
    expect(html.indexOf('id="o_explain"')).toBeLessThan(
      html.indexOf('id="o_levels"'),
    );
    expect(html.indexOf('id="o_levels"')).toBeLessThan(
      html.indexOf('data-act="saveopt"'),
    );
  });

  it('shows the ▤ for a player without a stored mode (D5)', () => {
    expect(page()).toContain('<option selected value="icon">Als ▤-Symbol');
  });

  it('has the box „Meine Aktivität & Spielzeit“ after the vacation mode (#231)', () => {
    const html = page();
    expect(html).toContain('Meine Aktivität &amp; Spielzeit');
    expect(html).toContain('id="own-activity"');
    expect(html.indexOf('Urlaubsmodus')).toBeLessThan(
      html.indexOf('id="own-activity"'),
    );
  });
});

describe('„Optionen“ without the box of the rules (#288, B4)', () => {
  const html = (): string => {
    const v = levelView({}, {}, [], { probes: 1, pushOff: [] });
    v.s.round = roundDefaults() as unknown as GameState['round'];
    v.s.homePlanet = 'p';
    v.ui = { animations: true, view: 'help' } as unknown as V['ui'];
    return help(v);
  };

  it('is called „Optionen“ and has no box „Regeln dieses Universums“', () => {
    const page = html();
    expect(page).toContain('<h2>Optionen</h2>');
    expect(page).not.toContain('Hilfe');
    expect(page).not.toContain('Regeln dieses Universums');
    expect(page).not.toContain('class="rules"');
  });

  it('links „Dieses Universum“ of the Lexicanum, which the Lexicanum opens', () => {
    const page = html();
    expect(page).toContain(
      '<a class="lx-a" data-a="rule-universe" data-act="lex" href="?view=lexicanum&amp;a=rule-universe">Dieses Universum</a>',
    );
    // The article exists, so the link does not lead nowhere.
    expect(article('rule-universe')?.title).toBe('Dieses Universum');
  });
});
