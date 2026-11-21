// The missions as strategies (owner, 2026-11-14, #116): the contract of the
// rules every mission in the generated index has, their names (#131, moved
// from texts.ts into the mission folders), and the generic check of the
// target kind. A new mission is checked here without new test code.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MISSION_TEXTS, MISSIONS } from '../features/index.gen.ts';
import { SHIPS } from './catalog.ts';
import {
  FLEET_MISSIONS,
  isFleet,
  launchOf,
  MISSION,
  type MissionRules,
  type SendError,
  type SendFleet,
  type SendTarget,
  type TargetKind,
  missionRules,
  SILO_MISSIONS,
  sendError,
  suits,
} from './missions.ts';
import { missionText } from './text.ts';
import type { Mission } from './types.ts';

/** A fleet and a target for the checks that look at neither. */
const fleet0: SendFleet = { owner: 'a', from: 'p1', ships: {} };
const target0: SendTarget = {
  planet: null,
  debris: false,
  protects: () => false,
  vacation: () => false,
};

const KINDS: TargetKind[] = [
  'own',
  'foreign',
  'any',
  'free',
  'debris',
  'foreignMoon',
  'ally',
];
/** Every target kind: the six above and the expedition position (#93). */
const TARGETS: TargetKind[] = [...KINDS, 'expedition'];
const CODES: SendError[] = [
  'occupied',
  'locked',
  'noPlanet',
  'samePlanet',
  'notOwn',
  'ownTarget',
  'protected',
  'vacation',
  'noColonyShip',
  'colonyLimit',
  'probesOnly',
  'noSpyTech',
  'noDebris',
  'noRecycler',
  'noMoon',
  'moonTarget',
  'notMoon',
  'noWorldbreaker',
  'surveyLocked',
  'surveyProbesOnly',
  'notAlly',
  'holdFleets',
  'holdPlayers',
  'expeditionLocked',
  'expeditionSlots',
  'notExpedition',
  'expeditionSpace',
];
const FIELDS = [
  'alertsGuild',
  'canSend',
  'cargo',
  'holds',
  'order',
  'returns',
  'silent',
  'target',
];
const RULES: [string, MissionRules][] = MISSIONS.map(([m, r]) => [m, r]);

describe('mission names', () => {
  it('names every mission and nothing else', () => {
    expect(MISSION).toEqual(
      Object.fromEntries(MISSION_TEXTS.map(([m, f]) => [m, f.texts.n])),
    );
    expect(Object.keys(MISSION)).toEqual([
      'attack',
      'transport',
      'spy',
      'colonize',
      'deploy',
      'harvest',
      'hold',
      'moonbreak',
      'survey',
      'missile',
      'expedition',
    ]);
  });

  it('has one text file per mission and none without a mission', () => {
    expect(MISSION_TEXTS.map(([m]) => m)).toEqual(MISSIONS.map(([m]) => m));
  });

  it.each(RULES)('%s: has a name and nothing else', (m) => {
    expect(missionText(m)!.n, m).toMatch(/\S/);
    expect(Object.keys(missionText(m)!)).toEqual(['n']);
  });

  it('keeps the mission names apart from the research texts', () => {
    for (const m of ['', 'toString', '__proto__', 'metal'])
      expect(missionText(m), m).toBeUndefined();
    expect(missionText('spy')!.n).toBe('Auspex-Erkundung');
    for (const [m, file] of MISSION_TEXTS)
      expect(missionText(m)).toBe(file.texts);
  });
});

/** Generated fleets: any ships, any counts, with or without an espionage technology (#175). */
const fleets: fc.Arbitrary<SendFleet> = fc.record(
  {
    owner: fc.constantFrom('a', 'b'),
    from: fc.constantFrom('p1', 'p2'),
    ships: fc.dictionary(
      fc.constantFrom(...Object.keys(SHIPS), 'nope'),
      fc.integer({ min: 0, max: 50 }),
    ),
    // The research of the owner: the Vermessung needs Auspex-Kartographie (#190).
    research: fc.dictionary(
      fc.constantFrom('carto', 'spy'),
      fc.integer({ min: 0, max: 3 }),
    ),
  },
  { requiredKeys: ['owner', 'from', 'ships'] },
);

const planets = fc.option(
  fc.record({
    id: fc.constantFrom('p1', 'p2'),
    owner: fc.constantFrom('a', 'b'),
  }),
);

describe('the rules of every mission (contract)', () => {
  it('lists the missions of the folders, the first one preselected', () => {
    expect(RULES.map(([m]) => m)).toEqual([
      'attack',
      'colonize',
      'deploy',
      'expedition',
      'harvest',
      'hold',
      'missile',
      'moonbreak',
      'spy',
      'survey',
      'transport',
    ]);
    expect(Object.keys(MISSION)[0]).toBe('attack');
  });

  it('starts every mission from the fleet form, the missiles from the silo (#54)', () => {
    for (const [m, r] of RULES) {
      expect(launchOf(r), m).toBe(m === 'missile' ? 'missiles' : 'fleet');
      expect(r.launch, m).toBe(m === 'missile' ? 'missiles' : undefined);
    }
    expect(FLEET_MISSIONS).toEqual(
      Object.keys(MISSION).filter((m) => m !== 'missile'),
    );
    expect(SILO_MISSIONS).toEqual(['missile']);
    const missile = missionRules('missile')!;
    expect(missile).toMatchObject({
      target: 'foreign',
      cargo: false,
      returns: false,
      alertsGuild: false,
    });
    expect(missile.canSend(fleet0, target0)).toBeUndefined();
  });

  it('gives a fleet slot and a recall to a fleet only: no gift, no missiles (#54, #161)', () => {
    expect(isFleet({ mission: 'attack' })).toBe(true);
    expect(isFleet({ mission: 'deploy', gift: true })).toBe(false);
    expect(isFleet({ mission: 'missile' })).toBe(false);
    expect(isFleet({ mission: 'nope' as Mission })).toBe(false);
  });

  it.each(RULES)('%s: has exactly the typed fields', (m, rules) => {
    // `launch` is only set where a mission does not start as a fleet (#54),
    // `maxStay` where it stays at its target (#93).
    const fields = [
      ...FIELDS,
      ...(rules.launch === undefined ? [] : ['launch']),
      ...(rules.maxStay === undefined ? [] : ['maxStay']),
      // `colonizes` is set only by the Landnahme (#237).
      ...(rules.colonizes === undefined ? [] : ['colonizes']),
      // `remembered` is set by the attack and the spy only (#292).
      ...(rules.remembered === undefined ? [] : ['remembered']),
      // `withoutShips` is set by the spy only (F12 of #214).
      ...(rules.withoutShips === undefined ? [] : ['withoutShips']),
    ];
    expect(Object.keys(rules).sort(), m).toEqual(fields.sort());
    expect(TARGETS, m).toContain(rules.target);
    for (const field of [
      'cargo',
      'returns',
      'silent',
      'alertsGuild',
      'holds',
    ] as const)
      expect(typeof rules[field], `${m}.${field}`).toBe('boolean');
    expect(typeof rules.canSend, m).toBe('function');
    expect(missionRules(m), m).toBe(rules);
  });

  it('alerts a guild only for the attack and the Mondbruch (#169 D3; owner, 2026-11-16, #95)', () => {
    expect(RULES.filter(([, r]) => r.alertsGuild).map(([m]) => m)).toEqual([
      'attack',
      'moonbreak',
    ]);
  });

  it('orders the missions in steps of 10, each once', () => {
    const orders = RULES.map(([, r]) => r.order);
    for (const o of orders) expect(o > 0 && o % 10 === 0, String(o)).toBe(true);
    expect(new Set(orders).size).toBe(orders.length);
    const byOrder = [...RULES].sort(([, a], [, b]) => a.order - b.order);
    expect(Object.keys(MISSION)).toEqual(byOrder.map(([m]) => m));
  });

  it.each(RULES)(
    '%s: canSend gives a known code or nothing on generated fleets',
    (m, rules) => {
      fc.assert(
        fc.property(
          fleets,
          planets,
          fc.boolean(),
          fc.boolean(),
          (fleet, planet, debris, moon) => {
            const target: SendTarget = {
              planet,
              debris,
              moon,
              protects: () => false,
              vacation: () => false,
            };
            const code = rules.canSend(fleet, target);
            if (code !== undefined) expect(CODES, m).toContain(code);
            const all = sendError(rules, fleet, target);
            if (all !== undefined) expect(CODES, m).toContain(all);
          },
        ),
        { seed: 116, numRuns: 200 },
      );
    },
  );

  it('has no rules for a name that is no mission', () => {
    for (const m of ['', 'nope', 'constructor', 'toString', '__proto__'])
      expect(missionRules(m), m).toBeUndefined();
  });
});

describe('the target kind (#116)', () => {
  const own = { id: 'p2', owner: 'a' };
  const foreign = { id: 'p3', owner: 'b' };

  it('suits a planet of the right owner, or a free position', () => {
    // The kinds: own, foreign, any, free, debris, foreignMoon, ally.
    expect(KINDS.map((k) => suits(k, 'a', own))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(KINDS.map((k) => suits(k, 'a', foreign))).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
      true,
    ]);
    expect(KINDS.map((k) => suits(k, 'a', null))).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it('suits a foreign moon only for the kind of the Mondbruch (#95)', () => {
    const moon = (owner: string) => ({ owner, kind: 'moon' as const });
    const planet = (owner: string) => ({ owner, kind: 'planet' as const });
    expect(KINDS.map((k) => suits(k, 'a', moon('b')))).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      true,
    ]);
    expect(KINDS.map((k) => suits(k, 'a', moon('a')))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    // A moon that became its planet again no longer suits (#95).
    expect(suits('foreignMoon', 'a', planet('b'))).toBe(false);
    expect(suits('foreignMoon', 'a', null)).toBe(false);
    expect(suits('foreignMoon', 'a', moon('b'), true)).toBe(true);
  });

  it('suits a Trümmerfeld only while it is there, whatever planet is there (#45)', () => {
    for (const planet of [null, own, foreign]) {
      expect(suits('debris', 'a', planet, true)).toBe(true);
      expect(suits('debris', 'a', planet, false)).toBe(false);
      expect(suits('debris', 'a', planet)).toBe(false);
    }
    // The planet kinds do not ask for the field.
    expect(KINDS.map((k) => suits(k, 'a', own, true))).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  /** A mission with only the target kind, without a check of its own. */
  const rules = (target: TargetKind): MissionRules => ({
    order: 10,
    target,
    cargo: true,
    returns: true,
    silent: false,
    alertsGuild: false,
    holds: false,
    canSend: () => undefined,
  });
  const fleet: SendFleet = { owner: 'a', from: 'p1', ships: { lc: 1 } };
  const at = (
    planet: SendTarget['planet'],
    shielded = false,
    debris = false,
  ): SendTarget & { asked: string[] } => {
    const asked: string[] = [];
    return {
      planet,
      debris,
      asked,
      protects: (owner) => {
        asked.push(owner);
        return shielded;
      },
      vacation: () => false,
    };
  };
  const home = { id: 'p1', owner: 'a' };

  it('gives the messages of each kind in the order of before', () => {
    const errors = (planet: SendTarget['planet'], shielded = false) =>
      KINDS.map((k) => sendError(rules(k), fleet, at(planet, shielded)));
    // A Mondbruch flies only to a moon (#95); the planet of an ally is a
    // foreign planet that must be an ally's, which the mission asks (#55).
    expect(errors(null)).toEqual([
      'noPlanet',
      'noPlanet',
      'noPlanet',
      undefined,
      'noDebris',
      'notMoon',
      'noPlanet',
    ]);
    expect(errors(home, true)).toEqual([
      'samePlanet',
      'samePlanet',
      'samePlanet',
      'occupied',
      'noDebris',
      'notMoon',
      'samePlanet',
    ]);
    expect(errors(own, true)).toEqual([
      undefined,
      'ownTarget',
      undefined,
      'occupied',
      'noDebris',
      'notMoon',
      'notAlly',
    ]);
    expect(errors(foreign)).toEqual([
      'notOwn',
      undefined,
      undefined,
      'occupied',
      'noDebris',
      'notMoon',
      undefined,
    ]);
    expect(errors(foreign, true)).toEqual([
      'notOwn',
      'protected',
      undefined,
      'occupied',
      'noDebris',
      'notMoon',
      'protected',
    ]);
  });

  it('refuses every mission to a place of another player in vacation mode, before the noob protection (#223)', () => {
    const away = (planet: SendTarget['planet'], moon = false) => ({
      ...at(planet, true),
      moon,
      vacation: (owner: string) => owner === 'b',
    });
    for (const moon of [false, true]) {
      const errors = (planet: SendTarget['planet']) =>
        KINDS.map((k) => sendError(rules(k), fleet, away(planet, moon)));
      // The kinds: own, foreign, any, free, debris, foreignMoon, ally.
      expect(errors(foreign).slice(0, 3)).toEqual([
        'notOwn',
        'vacation',
        'vacation',
      ]);
      expect(errors(own).slice(0, 3)).toEqual([
        undefined,
        'ownTarget',
        undefined,
      ]);
      // The planet of an ally is protected like any foreign one: a Halten
      // at a player in vacation mode is refused (#55, #223).
      expect(errors(foreign)[6]).toBe('vacation');
      expect(errors(own)[6]).toBe('notAlly');
    }
    for (const kind of ['foreign', 'ally'] as const) {
      const target = away(foreign);
      sendError(rules(kind), fleet, target);
      expect(target.asked, kind).toEqual([]);
    }
    expect(
      sendError(rules('debris'), fleet, { ...away(foreign), debris: true }),
    ).toBeUndefined();
  });

  it('flies to a Trümmerfeld wherever it lies, also at the own planet or a protected one (#45)', () => {
    for (const planet of [null, home, own, foreign]) {
      const target = at(planet, true, true);
      expect(sendError(rules('debris'), fleet, target), planet?.id).toBe(
        undefined,
      );
      expect(target.asked).toEqual([]);
    }
    // A planet target ignores the field.
    expect(sendError(rules('own'), fleet, at(null, false, true))).toBe(
      'noPlanet',
    );
    expect(sendError(rules('free'), fleet, at(null, false, true))).toBe(
      undefined,
    );
  });

  it('colonizes no position while it is locked after an abandonment (#224, D2)', () => {
    const locked = (planet: SendTarget['planet']) => ({
      ...at(planet),
      locked: true,
    });
    // The kinds: own, foreign, any, free, debris, foreignMoon (no moon there), ally.
    expect(KINDS.map((k) => sendError(rules(k), fleet, locked(null)))).toEqual([
      'noPlanet',
      'noPlanet',
      'noPlanet',
      'locked',
      'noDebris',
      'notMoon',
      'noPlanet',
    ]);
    // A planet there is the first refusal; a lock at a free position only.
    expect(sendError(rules('free'), fleet, locked(own))).toBe('occupied');
    expect(
      sendError(rules('free'), fleet, { ...at(null), locked: false }),
    ).toBe(undefined);
    expect(
      sendError(rules('free'), fleet, { ...locked(null), moon: true }),
    ).toBe('moonTarget');
  });

  it('flies to a moon like to a planet; colonization and Bergung never target one (#53)', () => {
    const moon = (planet: SendTarget['planet'], debris = false) => ({
      ...at(planet, false, debris),
      moon: true,
    });
    const errors = (planet: SendTarget['planet'], debris = false) =>
      KINDS.map((k) => sendError(rules(k), fleet, moon(planet, debris)));
    // The kinds: own, foreign, any, free, debris, foreignMoon, ally.
    expect(errors(null)).toEqual([
      'noMoon',
      'noMoon',
      'noMoon',
      'moonTarget',
      'moonTarget',
      'noMoon',
      'noMoon',
    ]);
    expect(errors(null, true)).toEqual([
      'noMoon',
      'noMoon',
      'noMoon',
      'moonTarget',
      'moonTarget',
      'noMoon',
      'noMoon',
    ]);
    expect(errors(home)).toEqual([
      'samePlanet',
      'samePlanet',
      'samePlanet',
      'moonTarget',
      'moonTarget',
      'samePlanet',
      'samePlanet',
    ]);
    expect(errors(own)).toEqual([
      undefined,
      'ownTarget',
      undefined,
      'moonTarget',
      'moonTarget',
      'ownTarget',
      'notAlly',
    ]);
    expect(errors(foreign)).toEqual([
      'notOwn',
      undefined,
      undefined,
      'moonTarget',
      'moonTarget',
      undefined,
      undefined,
    ]);
    // A foreign moon is a foreign target: the noob protection holds (#95).
    const shielded = { ...at(foreign, true), moon: true };
    expect(sendError(rules('foreignMoon'), fleet, shielded)).toBe('protected');
    expect(shielded.asked).toEqual(['b']);
    // Not a moon: as before.
    expect(sendError(rules('own'), fleet, { ...at(null), moon: false })).toBe(
      'noPlanet',
    );
    expect(sendError(rules('free'), fleet, { ...at(null), moon: false })).toBe(
      undefined,
    );
    // The mission's own check comes after.
    const probes: MissionRules = {
      ...rules('foreign'),
      canSend: () => 'probesOnly',
    };
    expect(sendError(probes, fleet, moon(foreign))).toBe('probesOnly');
    expect(
      sendError(
        { ...rules('free'), canSend: () => 'noColonyShip' },
        fleet,
        moon(null),
      ),
    ).toBe('moonTarget');
  });

  it('asks for the noob protection only of a foreign target, for its owner', () => {
    for (const k of KINDS)
      for (const planet of [null, home, own, foreign]) {
        const target = at(planet, true);
        sendError(rules(k), fleet, target);
        expect(target.asked, `${k} ${planet?.id}`).toEqual(
          (k === 'foreign' || k === 'ally') && planet === foreign ? ['b'] : [],
        );
      }
  });

  it('runs the check of the mission only after the target kind', () => {
    const own: MissionRules = {
      ...rules('foreign'),
      canSend: () => 'probesOnly',
    };
    expect(sendError(own, fleet, at(home))).toBe('samePlanet');
    expect(sendError(own, fleet, at(foreign, true))).toBe('protected');
    expect(sendError(own, fleet, at(foreign))).toBe('probesOnly');
  });
});

describe('the expedition position (#93)', () => {
  const fleet: SendFleet = { owner: 'a', from: 'p1', ships: { lc: 1 } };
  const rules = (
    target: TargetKind,
    canSend: MissionRules['canSend'] = () => undefined,
  ): MissionRules => ({
    order: 10,
    target,
    cargo: false,
    returns: true,
    silent: false,
    alertsGuild: false,
    holds: false,
    canSend,
  });
  const nothing: SendTarget = {
    planet: null,
    debris: false,
    protects: () => false,
    vacation: () => false,
  };
  const there: SendTarget = { ...nothing, expedition: true };

  it('suits an empty place only, never a planet', () => {
    const planet = { owner: 'a' };
    expect(suits('expedition', 'a', null)).toBe(true);
    expect(suits('expedition', 'a', planet)).toBe(false);
    expect(suits('expedition', 'a', { owner: 'b' })).toBe(false);
    // Whatever lies there, a Trümmerfeld does not make it a planet.
    expect(suits('expedition', 'a', null, true)).toBe(true);
  });

  it('flies to the expedition position of a system and to no other position', () => {
    expect(sendError(rules('expedition'), fleet, there)).toBeUndefined();
    expect(sendError(rules('expedition'), fleet, nothing)).toBe(
      'notExpedition',
    );
    expect(
      sendError(rules('expedition'), fleet, { ...nothing, expedition: false }),
    ).toBe('notExpedition');
    // A Trümmerfeld at a planet position or a locked one is no expedition target.
    expect(
      sendError(rules('expedition'), fleet, {
        ...nothing,
        debris: true,
        locked: true,
      }),
    ).toBe('notExpedition');
  });

  it('runs the check of the mission after the position, and a moon is never the target', () => {
    const slots = rules('expedition', () => 'expeditionSlots');
    expect(sendError(slots, fleet, there)).toBe('expeditionSlots');
    expect(sendError(slots, fleet, nothing)).toBe('notExpedition');
    expect(
      sendError(rules('expedition'), fleet, { ...there, moon: true }),
    ).toBe('moonTarget');
    expect(sendError(slots, fleet, { ...there, moon: true })).toBe(
      'moonTarget',
    );
  });

  it('cannot be colonized or surveyed: a free-position mission is refused there before everything else', () => {
    expect(sendError(rules('free'), fleet, there)).toBe('expeditionSpace');
    expect(sendError(rules('free'), fleet, { ...there, locked: true })).toBe(
      'expeditionSpace',
    );
    expect(
      sendError(rules('free'), fleet, {
        ...there,
        planet: { id: 'p2', owner: 'b' },
      }),
    ).toBe('expeditionSpace');
    // At a planet position nothing changes.
    expect(sendError(rules('free'), fleet, nothing)).toBeUndefined();
    expect(sendError(rules('free'), fleet, { ...nothing, locked: true })).toBe(
      'locked',
    );
  });

  it('leaves the planet missions as they were: no planet at the position', () => {
    for (const k of ['own', 'foreign', 'any'] as const)
      expect(sendError(rules(k), fleet, there), k).toBe('noPlanet');
    expect(sendError(rules('foreignMoon'), fleet, there)).toBe('notMoon');
    // The Bergung of the Trümmerfeld there is allowed (Q5).
    expect(
      sendError(rules('debris'), fleet, { ...there, debris: true }),
    ).toBeUndefined();
    expect(sendError(rules('debris'), fleet, there)).toBe('noDebris');
  });

  it('is the expedition rule of the folder: only it stays at its target, and it is no Halten', () => {
    expect(missionRules('expedition')).toMatchObject({
      order: 110,
      target: 'expedition',
      cargo: false,
      returns: true,
      silent: false,
      alertsGuild: false,
      holds: false,
    });
    const rule = missionRules('expedition')!;
    expect(rule.maxStay!({ expo: 4 }, 1)).toBe(4);
    // The hours per level of the round scale it (owner, 2026-11-19).
    expect(rule.maxStay!({ expo: 4 }, 6)).toBe(24);
    for (const [m, r] of RULES) {
      expect(r.maxStay !== undefined, m).toBe(m === 'expedition');
      // `holds` is the Halten only, a stay is not one.
      expect(r.holds, m).toBe(m === 'hold');
    }
  });
});
