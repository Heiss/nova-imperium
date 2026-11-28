// Every switch of the round that turns a feature off hides it (#404; owner,
// 2026-11-25, 112a to 114a): a feature switched off is hidden, not shown as
// closed. The switches are read from the registry of the round settings
// (src/core/round.ts): a `switch` or a number from 0 to 1, as the live
// switches are kept (a switch of the registry cannot be live). Each one is
// mapped below to the views it turns off, or says why it turns off no view;
// a new switch fails here until it is mapped, and a view it is mapped to
// fails until it carries its rule `offered` (contract.ts). Through that rule
// the menu, the tabs of a phone, the address and the mount hide the view
// (registry.test.ts); the Lexicanum page of the view (`PageDef.offered`, the
// same function) is hidden by it (logic/lexicanum.ts). A setting that is a number
// is out of scope: it changes a rule of a feature, it does not turn one off.
import { describe, expect, it } from 'vitest';
import { PAGES } from '../../core/lexicon/pages/index.ts';
import { defaultRound } from '../../core/lexicon/state.ts';
import {
  ROUND_SETTINGS,
  type RoundRules,
  type RoundSetting,
} from '../../core/round.ts';
import type { ClientView } from './contract.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

/** A yes or no of the round: a switch, or a number that is 0 or 1. */
const isSwitch = (s: RoundSetting): boolean =>
  s.kind === 'switch' || (s.min === 0 && s.max === 1);

/** The switches of the registry, by name. */
const SWITCHES = ROUND_SETTINGS.filter(isSwitch).map((s) => s.name);

/**
 * What each switch turns off: its views, or no view with the reason. A view
 * shared by switches is offered while any of them is on.
 */
const TURNS_OFF: Readonly<
  Record<string, { views: readonly string[]; none?: string }>
> = {
  // „Achievements“ also shows the daily reward (#214).
  achievements: { views: ['achievements'] },
  daily: { views: ['achievements'] },
  guilds: { views: ['guilds'] },
  marketOn: { views: ['market'] },
  holdOn: {
    views: [],
    none: 'hides the mission Wache stellen in the fleet form (#440): a mission, no view',
  },
  unionOn: {
    views: [],
    none: 'hides the box „Verbandsangriff“ and the choice of a union in the fleet view and refuses opening, inviting and joining (#466): parts of a view, no view',
  },
  colonyResearch: {
    views: [],
    none: 'the research Kolonialverwaltung, a catalog entry the research list shows only in a round with it (#237); catalog entries are #375',
  },
  expeditionSpeed: {
    views: [],
    none: 'divides the stay of an expedition by the speed: a rule, no feature',
  },
  highscoreEconomy: {
    views: [],
    none: 'chooses whether Wirtschaft counts by number or by resources (#422): a rule, no feature',
  },
  highscoreMilitary: {
    views: [],
    none: 'chooses whether Militär counts by number or by resources (#422): a rule, no feature',
  },
};

const VIEWS: readonly ClientView[] = CLIENT_VIEWS.flatMap(
  ([, list]): readonly ClientView[] => list,
);

/** The round with every switch at a value: on (true, 1) or off. */
function roundWith(on: (name: string) => boolean): RoundRules {
  const round = { ...defaultRound() } as unknown as Record<string, unknown>;
  for (const s of ROUND_SETTINGS.filter(isSwitch))
    round[s.name] = s.kind === 'switch' ? on(s.name) : Number(on(s.name));
  return round as unknown as RoundRules;
}

/** The switches that turn off a view. */
const switchesOf = (view: string): string[] =>
  Object.keys(TURNS_OFF).filter((name) =>
    TURNS_OFF[name]!.views.includes(view),
  );

const VIEWS_OFF = [
  ...new Set(Object.values(TURNS_OFF).flatMap((t) => t.views)),
];

describe('the switches of the round (#404)', () => {
  it('are each mapped to the views they turn off, or say why they turn off none', () => {
    expect(Object.keys(TURNS_OFF).sort()).toEqual([...SWITCHES].sort());
    for (const [name, { views, none }] of Object.entries(TURNS_OFF))
      expect(views.length > 0 || !!none, name).toBe(true);
  });

  it('turn off views that exist and carry their rule `offered`', () => {
    for (const key of VIEWS_OFF) {
      const view = VIEWS.find((v) => v.key === key);
      expect(view, key).toBeDefined();
      expect(typeof view?.offered, `the rule of the view ${key}`).toBe(
        'function',
      );
    }
  });

  it('hide a view while all its switches are off, for every player and the admin, and offer it while one is on', () => {
    for (const key of VIEWS_OFF) {
      const rule = VIEWS.find((v) => v.key === key)!.offered!;
      const own = switchesOf(key);
      // Every combination of its own switches, all the others on.
      for (let bits = 0; bits < 2 ** own.length; bits++) {
        const on = (name: string): boolean =>
          !own.includes(name) || ((bits >> own.indexOf(name)) & 1) === 1;
        const round = roundWith(on);
        for (const admin of [false, true])
          expect(rule(round, admin), `${key} ${bits} ${admin}`).toBe(
            bits !== 0,
          );
      }
    }
  });

  it('offer every view with every switch on, as before (#404)', () => {
    const round = roundWith(() => true);
    for (const view of VIEWS)
      if (view.key !== 'admin')
        for (const admin of [false, true])
          expect(view.offered?.(round, admin) ?? true, view.key).toBe(true);
  });

  it('hide the Lexicanum page of a view they turn off by the same rule (113a)', () => {
    const ruleOf = (key: string) => VIEWS.find((v) => v.key === key)!.offered;
    const rules = VIEWS_OFF.map(ruleOf);
    // A page with a rule takes the very function of a view turned off here.
    for (const page of PAGES.filter((p) => p.offered !== undefined))
      expect(rules, page.id).toContain(page.offered);
    // Every view turned off here has its page, with its rule.
    for (const key of VIEWS_OFF)
      expect(
        PAGES.some((p) => p.offered === ruleOf(key)),
        `the Lexicanum page of ${key}`,
      ).toBe(true);
  });
});

// „Highscore zeigt“ (#422, 175a, 176a) has three values, so it is no switch
// of the list above; „nichts“ turns the Highscore off.
describe('„Highscore zeigt“ (#422)', () => {
  it('hides the Highscore with „nichts“ only, for every player and the admin', () => {
    const rule = VIEWS.find((v) => v.key === 'highscore')!.offered!;
    expect(typeof rule).toBe('function');
    for (const admin of [false, true]) {
      for (const shows of [0, 1])
        expect(
          rule(
            { ...defaultRound(), highscoreShows: shows } as RoundRules,
            admin,
          ),
        ).toBe(true);
      expect(
        rule({ ...defaultRound(), highscoreShows: 2 } as RoundRules, admin),
      ).toBe(false);
    }
  });
});
