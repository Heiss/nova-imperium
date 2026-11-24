// The rules that hold for every server feature (#326). The test names no
// feature and no count: a feature adds its actions and its part of the state in
// its own module (`serverFeature`), and each feature tests its own behaviour in
// its own test. The functions that put the tables together are tested here too.
import { describe, expect, it } from 'vitest';
import { ROUND_SETTINGS } from '../../core/round.ts';
import { SERVER_FEATURES } from '../features.gen.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import {
  assembleActions,
  assembleState,
  gatedBy,
  type Listed,
} from './assemble.ts';
import {
  ACTIONS,
  ADMIN_ACTIONS,
  GUILD_ACTIONS,
  runAction,
} from './dispatch.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import { GUILDS_OFF, roundRules } from './round.ts';
import { STATE_PARTS, stateFor } from './state.ts';

const features: Listed = SERVER_FEATURES;
const GROUPS = ['actions', 'adminActions'] as const;
const MEMBERS = [...GROUPS, 'state', 'enabled', 'off'];
const PLAIN = /^[a-z][a-zA-Z0-9]*$/;

/** The action names of one group of every feature. */
const namesOf = (group: (typeof GROUPS)[number]): string[] =>
  features.flatMap(([, feature]) => Object.keys(feature[group] ?? {}));

describe('the list of the server features', () => {
  it('names each module once, by its path in src/server', () => {
    const names = features.map(([name]) => name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9/-]*$/);
  });

  it('exports only the known members, at least one', () => {
    for (const [name, feature] of features) {
      const members = Object.keys(feature);
      expect(members.length, name).toBeGreaterThan(0);
      for (const member of members)
        expect(MEMBERS, `${name}: ${member}`).toContain(member);
    }
  });

  it('gives every action a plain name and a function', () => {
    for (const [name, feature] of features)
      for (const group of GROUPS)
        for (const [type, action] of Object.entries(feature[group] ?? {})) {
          expect(type, `${name}: ${type}`).toMatch(PLAIN);
          expect(typeof action, `${name}: ${type}`).toBe('function');
        }
  });

  it('defines no action name twice, not even in another group', () => {
    const all = GROUPS.flatMap(namesOf);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    expect(() => assembleActions({}, features)).not.toThrow();
  });

  it('puts every action into the table of dispatch.ts, in its group, behind the switch of its feature (#374)', () => {
    const { gates } = assembleActions({}, features);
    for (const [name, feature] of features)
      for (const type of Object.keys(feature.actions ?? {})) {
        expect(Object.hasOwn(ACTIONS, type), type).toBe(true);
        expect(ADMIN_ACTIONS.has(type), type).toBe(false);
        expect(gates[type]?.off, `${name}: ${type}`).toBe(
          feature.enabled ? feature.off : undefined,
        );
      }
    expect([...ADMIN_ACTIONS].sort()).toEqual(namesOf('adminActions').sort());
    for (const type of ADMIN_ACTIONS)
      expect(Object.hasOwn(ACTIONS, type), type).toBe(true);
    // The guild actions are exactly those behind the switch of guilds.
    const guild = Object.keys(gates).filter(
      (t) => gates[t]!.off === GUILDS_OFF,
    );
    expect(guild.length).toBeGreaterThan(0);
    expect([...GUILD_ACTIONS].sort()).toEqual(guild.sort());
  });

  it('refuses every action of a feature that is off with its refusal, and leaves every key of its part null (#374)', () => {
    const switched = features.filter(([, f]) => f.enabled);
    expect(switched.length).toBeGreaterThan(0);
    /** A world with Anna where the setting <key> of the round is 0. */
    const world = (key?: string) => {
      const ctx = testCtx();
      const anna = addUser(ctx, 'Anna');
      addPlanet(ctx, anna.id);
      if (key) ctx.admin.putSettings([[key, 0]]);
      return { ctx, anna };
    };
    for (const [name, feature] of switched) {
      expect(feature.enabled!(roundRules(world().ctx)), name).toBe(true);
      // Some setting of the round turns it off.
      const key = ROUND_SETTINGS.map((setting) => setting.key).find(
        (k) => !feature.enabled!(roundRules(world(k).ctx)),
      );
      expect(key, name).toBeDefined();
      const { ctx, anna } = world(key);
      for (const type of Object.keys(feature.actions ?? {}))
        expect(() => runAction(ctx, anna.id, { type }), type).toThrow(
          feature.off!,
        );
      const state = stateFor(ctx, anna);
      for (const key of feature.state?.keys ?? [])
        expect(state[key], `${name}: ${key}`).toBeNull();
    }
  });

  it('gives every part a number, plain keys and a build function', () => {
    for (const [name, feature] of features) {
      if (!feature.state) continue;
      const { order, keys, build } = feature.state;
      expect(Number.isInteger(order) && order > 0, name).toBe(true);
      expect(keys.length, name).toBeGreaterThan(0);
      for (const key of keys) expect(key, `${name}: ${key}`).toMatch(PLAIN);
      expect(typeof build, name).toBe('function');
    }
  });

  it('defines no state key and no number twice, and puts the parts in the order of their numbers', () => {
    expect(() => assembleState([], features)).not.toThrow();
    const orders = STATE_PARTS.map((part) => part.order);
    expect(orders).toEqual([...new Set(orders)].sort((a, b) => a - b));
    const keys = STATE_PARTS.flatMap((part) => part.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('builds exactly the keys the parts declare, in the order of the parts', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const admin = addUser(ctx, 'Admin', { admin: true });
    addPlanet(ctx, anna.id);
    addPlanet(ctx, admin.id, { s: 2 });
    const declared = STATE_PARTS.flatMap((part) => part.keys);
    expect(Object.keys(stateFor(ctx, anna))).toEqual(declared);
    expect(Object.keys(stateFor(ctx, admin))).toEqual(declared);
  });

  it('builds the same keys for a player without a planet', () => {
    const ctx = testCtx();
    const declared = STATE_PARTS.flatMap((part) => part.keys);
    expect(Object.keys(stateFor(ctx, addUser(ctx, 'Cora')))).toEqual(declared);
  });

  it('keeps the lock screen of the vacation mode to declared keys, in their order', () => {
    const ctx = testCtx();
    const vac = addUser(ctx, 'Vera', { vacation: 5 });
    addPlanet(ctx, vac.id);
    const declared = STATE_PARTS.flatMap((part) => part.keys);
    const locked = Object.keys(stateFor(ctx, vac));
    expect(locked.length).toBeGreaterThan(0);
    expect(locked.length).toBeLessThan(declared.length);
    // A subsequence: every key of the lock screen is declared, none moves.
    expect(declared.filter((key) => locked.includes(key))).toEqual(locked);
  });
});

describe('the table of the actions', () => {
  const a = () => 'a';
  const b = () => 'b';
  const c = () => 'c';
  const feature = (f: ServerFeature): Listed[number] => ['game/one', f];

  it('holds the frame and the actions of every module, each in its group', () => {
    const on = () => true;
    const { actions, gates, admin } = assembleActions({ build: a }, [
      feature({ actions: { send: b } }),
      ['game/two', { actions: { createGuild: c }, enabled: on, off: 'Aus.' }],
      ['push-options', { adminActions: { settings: a }, actions: { pct: c } }],
      ['game/empty', {}],
    ]);
    expect(Object.keys(actions).sort()).toEqual([
      'build',
      'createGuild',
      'pct',
      'send',
      'settings',
    ]);
    expect(actions.build).toBe(a);
    expect(actions.send).toBe(b);
    expect(actions.createGuild).toBe(c);
    expect(gates).toEqual({ createGuild: { enabled: on, off: 'Aus.' } });
    expect([...admin]).toEqual(['settings']);
  });

  it('throws when two modules define one name, naming both files', () => {
    expect(() =>
      assembleActions({}, [
        feature({ actions: { send: a } }),
        ['push-options', { actions: { send: b } }],
      ]),
    ).toThrow(
      'action "send" is defined in src/server/game/one.ts and in src/server/push-options.ts.',
    );
  });

  it('names the actions behind one switch by its refusal (#374)', () => {
    const on = () => true;
    const { gates } = assembleActions({}, [
      ['game/one', { actions: { send: a }, enabled: on, off: 'Eins aus.' }],
      [
        'game/two',
        { actions: { build: b, pct: c }, enabled: on, off: 'Zwei aus.' },
      ],
      ['game/three', { actions: { rename: a } }],
    ]);
    expect([...gatedBy(gates, 'Zwei aus.')].sort()).toEqual(['build', 'pct']);
    expect([...gatedBy(gates, 'Eins aus.')]).toEqual(['send']);
    expect([...gatedBy(gates, 'Keiner.')]).toEqual([]);
  });

  it('throws when a feature has a switch but no refusal (#374)', () => {
    expect(() =>
      assembleActions({}, [
        feature({ actions: { send: a }, enabled: () => true }),
      ]),
    ).toThrow('src/server/game/one.ts has enabled but no refusal (off).');
  });

  it('throws when a name is in two groups of one module, or in the frame', () => {
    expect(() =>
      assembleActions({}, [
        feature({ actions: { send: a }, adminActions: { send: b } }),
      ]),
    ).toThrow(
      'action "send" is defined in src/server/game/one.ts and in src/server/game/one.ts.',
    );
    expect(() =>
      assembleActions({ build: a }, [feature({ adminActions: { build: b } })]),
    ).toThrow(
      'action "build" is defined in src/server/game/dispatch.ts and in src/server/game/one.ts.',
    );
  });
});

describe('the parts of the state', () => {
  const part = (order: number, ...keys: string[]): StatePart => ({
    order,
    keys,
    build: () => ({}),
  });
  const feature = (state: StatePart): Listed[number] => ['game/one', { state }];

  it('puts the frame and the parts of the modules in the order of their numbers', () => {
    const frame = [part(30, 'cfg'), part(10, 'round')];
    const added = part(20, 'homePlanet', 'mainPlanet');
    expect(
      assembleState(frame, [feature(added), ['game/none', {}]]).map(
        (p) => p.keys,
      ),
    ).toEqual([['round'], ['homePlanet', 'mainPlanet'], ['cfg']]);
  });

  it('leaves every key of a feature that is off null, and builds it while on (#374)', () => {
    const built = { ...part(20, 'a', 'b'), build: () => ({ a: 1, b: 2 }) };
    const [only] = assembleState(
      [],
      [['game/one', { state: built, enabled: (r) => r.guilds, off: 'Aus.' }]],
    );
    const view = (guilds: boolean) =>
      ({ round: { guilds } }) as unknown as Parameters<StatePart['build']>[2];
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    expect(only!.build(ctx, u, view(true))).toEqual({ a: 1, b: 2 });
    expect(only!.build(ctx, u, view(false))).toEqual({ a: null, b: null });
    expect(only!.keys).toEqual(['a', 'b']);
  });

  it('throws when a key or a number exists twice, naming both files', () => {
    expect(() =>
      assembleState([part(10, 'round')], [feature(part(20, 'round'))]),
    ).toThrow(
      'state key "round" is defined in src/server/game/state.ts and in src/server/game/one.ts.',
    );
    expect(() =>
      assembleState([part(10, 'round')], [feature(part(10, 'locks'))]),
    ).toThrow(
      'state order "10" is defined in src/server/game/state.ts and in src/server/game/one.ts.',
    );
    expect(() =>
      assembleState(
        [],
        [
          feature(part(10, 'locks')),
          ['push-options', { state: part(20, 'locks') }],
        ],
      ),
    ).toThrow(
      'state key "locks" is defined in src/server/game/one.ts and in src/server/push-options.ts.',
    );
  });
});
