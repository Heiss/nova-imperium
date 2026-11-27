// The rework of „Wache stellen“ (#440): the switch of the round, the re-check
// of every hold with the report to its owner, „Wegschicken“ of the host, the
// option „Keine Wachen annehmen“, the reports to the host, the push topic
// „Wachen“, and the noob protection that lapses at a place where a foreign
// fleet holds (for attacks and espionage, not for missiles).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HOUR_MS, homeAt } from '../../core/holding.ts';
import {
  HOLD_OFF_REFUSAL,
  HOLD_REASON_TEXT,
  HOLD_REPORT_TITLE,
  HOLDS_REFUSED_REFUSAL,
} from '../../core/hold-texts.ts';
import type { Fleet } from '../../core/types.ts';
import { openDatabase } from '../db/database.ts';
import { startServer } from '../server.ts';
import {
  type TestCtx,
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testConfig,
  testCtx,
} from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { runAction } from './dispatch.ts';
import { send } from './fleet-actions.ts';
import { lockEndText } from './main-planet.ts';
import { roundRules } from './round.ts';
import { storedScores } from './scores.ts';
import { protectedIn, stateFor } from './state.ts';

const PROTECTED = 'Dieser Spieler steht unter Noobschutz.';
const ANNA = { g: 1, s: 1, p: 5 };
const BERT = { g: 1, s: 2, p: 1 };

/**
 * Anna, strong, at [1:1:5] with ships, Auspex probes and Orbitalraketen; Bert,
 * weak, at [1:2:1] (Beta) and [1:2:9]; Cora is Bert's friend; Ada is the
 * admin.
 */
function world(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { research: { spy: 4, impulse: 1, energy: 10 } });
  addUser(ctx, 'Bert');
  // Fleet slots enough for her guards and a launch.
  addUser(ctx, 'Cora', { research: { energy: 10, computer: 5 } });
  addUser(ctx, 'Ada', { admin: true });
  addPlanet(ctx, 'u_Anna', {
    ...ANNA,
    b: { metal: 20, crystal: 18, yard: 1, silo: 4 },
    ships: { lf: 50, probe: 5 },
    def: { ipm: 5 },
    res: { m: 1e6, c: 1e6, d: 1e6 },
  });
  addPlanet(ctx, 'u_Bert', { ...BERT, name: 'Beta', b: { metal: 1 } });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 9, b: { metal: 1 } });
  addPlanet(ctx, 'u_Cora', {
    g: 1,
    s: 3,
    p: 7,
    ships: { lf: 20 },
    res: { m: 1e5, c: 1e5, d: 1e5 },
  });
  befriend(ctx, 'u_Cora', 'u_Bert');
  return ctx;
}

function befriend(ctx: TestCtx, a: string, b: string): void {
  ctx.friends.request(a, b);
  ctx.friends.accept(a, b);
}

const user = (ctx: TestCtx, name: string) => ctx.players.get(`u_${name}`)!;
const act = (ctx: TestCtx, uid: string, d: Record<string, unknown>) =>
  runAction(ctx, uid, d as never);

/** A fleet of Cora that holds at Beta now, or flies there to hold. */
function guard(ctx: TestCtx, over: Partial<Fleet> = {}): Fleet {
  const f: Fleet = {
    id: 'h1',
    owner: 'u_Cora',
    from: 'p1_3_7',
    fromC: { g: 1, s: 3, p: 7 },
    to: 'p1_2_1',
    toC: BERT,
    mission: 'hold',
    ships: { lf: 2 },
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 1000,
    arr: ctx.now() - 400,
    ret: ctx.now() + HOUR_MS,
    state: 'hold',
    recalled: false,
    fuel: 3,
    hold: HOUR_MS,
    ...over,
  };
  ctx.fleets.save(f);
  return f;
}

/** A guard of Cora on its way, arriving in 600 ms. */
const flying = (ctx: TestCtx): Fleet =>
  guard(ctx, { state: 'out', arr: ctx.now() + 600, ret: ctx.now() + 3000 });

/** A hold of Cora to Beta, sent through the server. */
const holdTo = (ctx: TestCtx) =>
  send(ctx, user(ctx, 'Cora'), {
    planet: 'p1_3_7',
    mission: 'hold',
    ships: { lf: 2 },
    to: BERT,
    pct: 10,
    cargo: {},
    hold: 2,
  });

/** The report „no longer allowed“ of Cora's guard for `reason`, at `at`. */
const notAllowed = (reason: keyof typeof HOLD_REASON_TEXT, at: number) => ({
  type: 'info',
  time: at,
  title: HOLD_REPORT_TITLE.notAllowed,
  text: `Deine Wache bei Beta [1:2:1] kehrt zurück: ${HOLD_REASON_TEXT[reason]}.`,
});

/** Cora's guard is back on its way home: as at its end when it held, as a recall when it flew. */
function expectHome(ctx: TestCtx, f: Fleet, at = ctx.now()): void {
  expect(ctx.fleets.get(f.id)).toMatchObject(
    f.state === 'hold'
      ? { state: 'back', ret: homeAt(f, at), recalled: false }
      : { state: 'back', ret: at + (at - f.dep), recalled: true },
  );
}

const settings = (ctx: TestCtx, over: Record<string, number>) =>
  act(ctx, 'u_Ada', {
    type: 'settings',
    settings: { ...ctx.admin.universe(), ...over },
  });

describe('the switch „Wache stellen“ of the round (#440, 240a)', () => {
  it('is on by default', () => {
    const ctx = world();
    expect(roundRules(ctx).holdOn).toBe(1);
    holdTo(ctx);
    expect(ctx.fleets.all().map((f) => f.mission)).toEqual(['hold']);
  });

  it('off refuses a launch, and turns every running hold home with its report', () => {
    const ctx = world();
    const held = guard(ctx);
    const out = guard(ctx, {
      id: 'h2',
      state: 'out',
      arr: ctx.now() + 600,
      ret: ctx.now() + 3000,
    });
    // A fleet already home bound is left as it is.
    const back = guard(ctx, { id: 'h3', state: 'back', ret: ctx.now() + 50 });
    settings(ctx, { roundHoldOn: 0 });
    expect(roundRules(ctx).holdOn).toBe(0);
    expectHome(ctx, held);
    expectHome(ctx, out);
    expect(ctx.fleets.get('h3')).toEqual(back);
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      notAllowed('off', ctx.now()),
      notAllowed('off', ctx.now()),
    ]);
    expect(() => holdTo(ctx)).toThrow(HOLD_OFF_REFUSAL);
    settings(ctx, { roundHoldOn: 1 });
    holdTo(ctx);
  });

  it('is a choice of „Neue Runde“ too', () => {
    const ctx = world();
    act(ctx, 'u_Ada', { type: 'reset', holdOn: 0 });
    expect(roundRules(ctx).holdOn).toBe(0);
  });
});

describe('the re-check of every hold (#440, 229a)', () => {
  it('turns home a hold whose friendship ended, holding or on its way', () => {
    const ctx = world();
    const held = guard(ctx);
    act(ctx, 'u_Bert', { type: 'removeFriend', uid: 'u_Cora' });
    expectHome(ctx, held);
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      notAllowed('bond', ctx.now()),
    ]);
    const ctx2 = world();
    const out = flying(ctx2);
    act(ctx2, 'u_Cora', { type: 'removeFriend', uid: 'u_Bert' });
    expectHome(ctx2, out);
  });

  it('keeps a hold that is still allowed, and writes nothing', () => {
    const ctx = world();
    const held = guard(ctx);
    befriend(ctx, 'u_Anna', 'u_Bert');
    act(ctx, 'u_Bert', { type: 'removeFriend', uid: 'u_Anna' });
    expect(ctx.fleets.get('h1')).toEqual(held);
    expect(ctx.reports.ofPlayer('u_Cora')).toEqual([]);
  });

  it('turns home when „Verbündete“ changes so that friends no longer count', () => {
    const ctx = world();
    const held = guard(ctx);
    // 1 is „Gilde“: friends are no allies then.
    settings(ctx, { roundAllies: 1 });
    expectHome(ctx, held);
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      notAllowed('bond', ctx.now()),
    ]);
  });

  /** Bert and Cora in a guild of Bert, without the friendship. */
  function guild(): TestCtx {
    const ctx = world();
    ctx.friends.remove('u_Cora', 'u_Bert');
    ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Bert');
    ctx.guilds.apply('u_Cora', 'g1');
    ctx.guilds.accept('u_Cora');
    return ctx;
  }

  it('turns home when the guild member leaves, is removed, or the guild is dissolved', () => {
    const left = guild();
    const a = guard(left);
    act(left, 'u_Cora', { type: 'leaveGuild' });
    expectHome(left, a);
    const removed = guild();
    const b = guard(removed);
    act(removed, 'u_Bert', { type: 'manageGuildMember', uid: 'u_Cora' });
    expectHome(removed, b);
    const dissolved = guild();
    const c = guard(dissolved);
    act(dissolved, 'u_Bert', { type: 'dissolveGuild', tag: 'GLD' });
    expectHome(dissolved, c);
    for (const ctx of [left, removed, dissolved])
      expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
        notAllowed('bond', ctx.now()),
      ]);
  });

  it('runs at every score pass: a change no action names turns the hold home there at the latest', () => {
    const ctx = world();
    const held = guard(ctx);
    ctx.friends.remove('u_Cora', 'u_Bert');
    expect(ctx.fleets.get('h1')).toEqual(held);
    storedScores(ctx);
    expectHome(ctx, held);
  });

  it('turns home at its arrival a hold that is no longer allowed (4a)', () => {
    const ctx = world();
    holdTo(ctx);
    const f = ctx.fleets.all()[0]!;
    ctx.friends.remove('u_Cora', 'u_Bert');
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      ret: f.arr + (f.arr - f.dep),
    });
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      notAllowed('bond', f.arr),
    ]);
  });
});

describe('„Wegschicken“ of the host (#440, 230b, 231a)', () => {
  const away = (ctx: TestCtx, uid: string, id: string) =>
    act(ctx, uid, { type: 'sendAway', id });

  it('sends a hold home at once from its place, and tells its owner', () => {
    const ctx = world();
    const held = guard(ctx);
    expect(away(ctx, 'u_Bert', 'h1')).toBeNull();
    expectHome(ctx, held);
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      {
        type: 'info',
        time: ctx.now(),
        title: HOLD_REPORT_TITLE.sentAway,
        text: 'Bert hat deine Wache bei Beta [1:2:1] weggeschickt. Deine Flotte kehrt zurück.',
      },
    ]);
  });

  it('turns a hold on its way back like a recall', () => {
    const ctx = world();
    const out = flying(ctx);
    away(ctx, 'u_Bert', 'h1');
    expectHome(ctx, out);
  });

  it('is refused for a fleet that is no running hold at the own place', () => {
    const ctx = world();
    guard(ctx);
    guard(ctx, { id: 'h2', state: 'back' });
    guard(ctx, { id: 'a1', mission: 'attack', hold: undefined, state: 'out' });
    for (const [uid, id] of [
      ['u_Anna', 'h1'],
      ['u_Cora', 'h1'],
      ['u_Bert', 'h2'],
      ['u_Bert', 'a1'],
      ['u_Bert', 'nope'],
    ] as const)
      expect(() => away(ctx, uid, id), `${uid} ${id}`).toThrow('Ungültig.');
    expect(ctx.reports.ofPlayer('u_Cora')).toEqual([]);
  });
});

describe('„Keine Wachen annehmen“ (#440, 230b, 282a)', () => {
  const option = (ctx: TestCtx, on: unknown) =>
    act(ctx, 'u_Bert', { type: 'holdOption', on });

  it('is off by default and in the state of the player', () => {
    const ctx = world();
    expect(stateFor(ctx, user(ctx, 'Bert')).holdsRefused).toBe(false);
    expect(option(ctx, true)).toBe('Gespeichert.');
    expect(stateFor(ctx, user(ctx, 'Bert')).holdsRefused).toBe(true);
    expect(stateFor(ctx, user(ctx, 'Cora')).holdsRefused).toBe(false);
    option(ctx, 'yes');
    expect(ctx.holdRefusals.refuses('u_Bert')).toBe(false);
  });

  it('on refuses a launch, and turns every running hold home', () => {
    const ctx = world();
    const held = guard(ctx);
    option(ctx, true);
    expectHome(ctx, held);
    expect(ctx.reports.ofPlayer('u_Cora')).toMatchObject([
      notAllowed('refused', ctx.now()),
    ]);
    expect(() => holdTo(ctx)).toThrow(HOLDS_REFUSED_REFUSAL);
    option(ctx, false);
    holdTo(ctx);
  });

  it('is kept across a new round', () => {
    const ctx = world();
    option(ctx, true);
    act(ctx, 'u_Ada', { type: 'reset' });
    expect(ctx.holdRefusals.refuses('u_Bert')).toBe(true);
  });
});

describe('the reports to the host (#440, 242c) and the push topic „Wachen“ (243b, 283a)', () => {
  it('tells the host at the launch and at the arrival, pushed under „Wachen“', () => {
    const ctx = world();
    subscribePush(ctx, 'u_Bert');
    subscribePush(ctx, 'u_Cora');
    holdTo(ctx);
    const f = ctx.fleets.all()[0]!;
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      {
        type: 'info',
        time: f.dep,
        title: HOLD_REPORT_TITLE.launch,
        text: `Cora schickt eine Wache zu Beta [1:2:1]. Ankunft: ${lockEndText(f.arr)}.`,
      },
    ]);
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.fleets.get(f.id)).toMatchObject({ state: 'hold' });
    expect(ctx.reports.ofPlayer('u_Bert')[0]).toMatchObject({
      type: 'info',
      time: f.arr,
      title: HOLD_REPORT_TITLE.arrival,
      text: `Cora hält mit einer Flotte Wache bei Beta [1:2:1] bis ${lockEndText(f.arr + 2 * HOUR_MS)}.`,
    });
    act(ctx, 'u_Bert', { type: 'sendAway', id: f.id });
    expect(queuedPushes(ctx).filter((p) => p.topic === 'holds')).toMatchObject([
      { user: 'u_Bert' },
      { user: 'u_Bert' },
      { user: 'u_Cora' },
    ]);
  });
});

describe('the noob protection where a foreign fleet holds (#440, 238c, 281b)', () => {
  /** Whether a send of Anna to the planet at [1:2:p] is refused for the protection. */
  function refused(ctx: TestCtx, mission: string, p: number): boolean {
    try {
      send(ctx, user(ctx, 'Anna'), {
        planet: 'p1_1_5',
        mission,
        ships: mission === 'spy' ? { probe: 1 } : { lf: 1 },
        to: { g: 1, s: 2, p },
        pct: 100,
        cargo: {},
        hold: 1,
      });
      ctx.db.prepare("DELETE FROM fleets WHERE owner = 'u_Anna'").run();
      return false;
    } catch (e) {
      if ((e as Error).message === PROTECTED) return true;
      throw e;
    }
  }

  const missile = (ctx: TestCtx) =>
    act(ctx, 'u_Anna', {
      type: 'missile',
      planet: 'p1_1_5',
      to: { ...BERT, kind: 'planet' },
      n: 1,
    });

  it('lapses for an attack and an espionage at that place only, while the fleet holds', () => {
    const ctx = world();
    expect(refused(ctx, 'attack', 1)).toBe(true);
    expect(refused(ctx, 'spy', 1)).toBe(true);
    // On its way it does not hold yet.
    flying(ctx);
    expect(refused(ctx, 'attack', 1)).toBe(true);
    ctx.fleets.delete('h1');
    guard(ctx);
    expect(refused(ctx, 'attack', 1)).toBe(false);
    expect(refused(ctx, 'spy', 1)).toBe(false);
    expect(refused(ctx, 'attack', 9)).toBe(true);
    // Missiles keep the protection.
    expect(() => missile(ctx)).toThrow(PROTECTED);
    act(ctx, 'u_Bert', { type: 'sendAway', id: 'h1' });
    expect(refused(ctx, 'attack', 1)).toBe(true);
  });

  it('allows a hold at a weak host', () => {
    const ctx = world();
    befriend(ctx, 'u_Anna', 'u_Bert');
    expect(refused(ctx, 'hold', 1)).toBe(false);
  });

  it('shows no (n) on the Sternenkarte at that place, the owner stays protected elsewhere', () => {
    const ctx = world();
    const at = { g: 1, s: 2 };
    expect(protectedIn(ctx, 'u_Anna', at)).toEqual({
      ...at,
      owners: ['u_Bert'],
    });
    guard(ctx);
    expect(protectedIn(ctx, 'u_Anna', at)).toEqual({
      ...at,
      owners: ['u_Bert'],
      lapsed: ['p1_2_1'],
    });
    // The host's own fleet there is no foreign one.
    ctx.fleets.delete('h1');
    guard(ctx, { id: 'own', owner: 'u_Bert' });
    expect(protectedIn(ctx, 'u_Anna', at)).not.toHaveProperty('lapsed');
  });
});

describe('the start of the server (#440): it checks every hold, after an update too', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('turns home the holds that are no longer allowed, and keeps the others', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'nova-hold-'));
    const file = path.join(dir, 'game.sqlite');
    const db = openDatabase(file);
    const ctx = testCtx(Date.now(), 42, db);
    addUser(ctx, 'Bert');
    addUser(ctx, 'Cora');
    addUser(ctx, 'Dora');
    addPlanet(ctx, 'u_Bert', { ...BERT, name: 'Beta' });
    addPlanet(ctx, 'u_Cora', { g: 1, s: 3, p: 7 });
    addPlanet(ctx, 'u_Dora', { g: 1, s: 4, p: 7 });
    befriend(ctx, 'u_Dora', 'u_Bert');
    const at = Date.now();
    const base = {
      ...guard(ctx),
      dep: at - 1000,
      arr: at - 400,
      ret: at + HOUR_MS,
    };
    ctx.fleets.save(base);
    ctx.fleets.save({ ...base, id: 'h2', owner: 'u_Dora' });
    db.close();
    const running = await startServer({
      cfg: testConfig({ dataDir: dir }),
      publicDir: path.resolve(import.meta.dirname, '../../test/public'),
      dbFile: file,
      log: () => {},
      migrate: () => Promise.resolve(),
    });
    try {
      // Cora has no bond with Bert: home; Dora is his friend: she holds on.
      expect(running.ctx!.fleets.get('h1')).toMatchObject({ state: 'back' });
      expect(running.ctx!.fleets.get('h2')).toMatchObject({ state: 'hold' });
    } finally {
      await running.stop();
    }
  });
});
