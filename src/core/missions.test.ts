// The missions as strategies (owner, 2026-11-14, #116): the contract of the
// rules every mission in the generated index has, their names (#131, moved
// from texts.ts into the mission folders), and the generic check of the
// target kind. A new mission is checked here without new test code.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MISSION_TEXTS, MISSIONS } from '../features/index.gen.ts';
import { SHIPS } from './catalog.ts';
import {
  MISSION,
  type MissionRules,
  type SendError,
  type SendFleet,
  type SendTarget,
  type TargetKind,
  missionRules,
  sendError,
  suits,
} from './missions.ts';
import { missionText } from './text.ts';

const KINDS: TargetKind[] = ['own', 'foreign', 'any', 'free'];
const CODES: SendError[] = [
  'occupied',
  'noPlanet',
  'samePlanet',
  'notOwn',
  'ownTarget',
  'protected',
  'noColonyShip',
  'probesOnly',
];
const FIELDS = [
  'canSend',
  'cargo',
  'order',
  'returns',
  'silent',
  'target',
  'visible',
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

/** Generated fleets: any ships, any counts. */
const fleets: fc.Arbitrary<SendFleet> = fc.record({
  owner: fc.constantFrom('a', 'b'),
  from: fc.constantFrom('p1', 'p2'),
  ships: fc.dictionary(
    fc.constantFrom(...Object.keys(SHIPS), 'nope'),
    fc.integer({ min: 0, max: 50 }),
  ),
});

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
      'spy',
      'transport',
    ]);
    expect(Object.keys(MISSION)[0]).toBe('attack');
  });

  it.each(RULES)('%s: has exactly the typed fields', (m, rules) => {
    expect(Object.keys(rules).sort(), m).toEqual(FIELDS);
    expect(KINDS, m).toContain(rules.target);
    for (const field of ['cargo', 'returns', 'visible', 'silent'] as const)
      expect(typeof rules[field], `${m}.${field}`).toBe('boolean');
    expect(typeof rules.canSend, m).toBe('function');
    expect(missionRules(m), m).toBe(rules);
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
        fc.property(fleets, planets, (fleet, planet) => {
          const target: SendTarget = { planet, protects: () => false };
          const code = rules.canSend(fleet, target);
          if (code !== undefined) expect(CODES, m).toContain(code);
          const all = sendError(rules, fleet, target);
          if (all !== undefined) expect(CODES, m).toContain(all);
        }),
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
    expect(KINDS.map((k) => suits(k, 'a', own))).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(KINDS.map((k) => suits(k, 'a', foreign))).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(KINDS.map((k) => suits(k, 'a', null))).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  /** A mission with only the target kind, without a check of its own. */
  const rules = (target: TargetKind): MissionRules => ({
    order: 10,
    target,
    cargo: true,
    returns: true,
    visible: false,
    silent: false,
    canSend: () => undefined,
  });
  const fleet: SendFleet = { owner: 'a', from: 'p1', ships: { lc: 1 } };
  const at = (
    planet: SendTarget['planet'],
    shielded = false,
  ): SendTarget & { asked: string[] } => {
    const asked: string[] = [];
    return {
      planet,
      asked,
      protects: (owner) => {
        asked.push(owner);
        return shielded;
      },
    };
  };
  const home = { id: 'p1', owner: 'a' };

  it('gives the messages of each kind in the order of before', () => {
    const errors = (planet: SendTarget['planet'], shielded = false) =>
      KINDS.map((k) => sendError(rules(k), fleet, at(planet, shielded)));
    expect(errors(null)).toEqual([
      'noPlanet',
      'noPlanet',
      'noPlanet',
      undefined,
    ]);
    expect(errors(home, true)).toEqual([
      'samePlanet',
      'samePlanet',
      'samePlanet',
      'occupied',
    ]);
    expect(errors(own, true)).toEqual([
      undefined,
      'ownTarget',
      undefined,
      'occupied',
    ]);
    expect(errors(foreign)).toEqual([
      'notOwn',
      undefined,
      undefined,
      'occupied',
    ]);
    expect(errors(foreign, true)).toEqual([
      'notOwn',
      'protected',
      undefined,
      'occupied',
    ]);
  });

  it('asks for the noob protection only of a foreign target, for its owner', () => {
    for (const k of KINDS)
      for (const planet of [null, home, own, foreign]) {
        const target = at(planet, true);
        sendError(rules(k), fleet, target);
        expect(target.asked, `${k} ${planet?.id}`).toEqual(
          k === 'foreign' && planet === foreign ? ['b'] : [],
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
