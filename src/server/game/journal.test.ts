// The journal of the round (#235, owner 2026-11-20): one event per action and
// per arrival, refusals recorded, nothing in a closed round, no secret and no
// free text in any row, seats and not account ids, the game unchanged.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVENT_KIND,
  type JournalAction,
  type JournalFleet,
} from '../../core/round-events.ts';
import { SERVER_FEATURES } from '../features.gen.ts';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { ACTIONS, runAction } from './dispatch.ts';
import { closeActiveRound } from './round-archive.ts';
import { INPUT, inputOf } from './journal-input.ts';
import { journalRefusal } from './journal.ts';

function setup(): TestCtx {
  const ctx = testCtx();
  const anna = addUser(ctx, 'Anna', { admin: true });
  const bert = addUser(ctx, 'Bert');
  addPlanet(ctx, anna.id, {
    g: 1,
    s: 1,
    p: 5,
    b: { metal: 3 },
    res: { m: 5000, c: 2000, d: 1000 },
  });
  addPlanet(ctx, bert.id, {
    g: 1,
    s: 2,
    p: 6,
    res: { m: 9000, c: 6000, d: 3000 },
  });
  return ctx;
}

const send = (ctx: TestCtx, who: string, d: Record<string, unknown>) =>
  runAction(ctx, `u_${who}`, d);

const journal = (ctx: TestCtx, kind: string = EVENT_KIND.action) =>
  ctx.rounds.events(1, kind);

const everything = (ctx: TestCtx): string =>
  JSON.stringify(ctx.db.prepare('SELECT * FROM round_events').all());

describe('one event per action', () => {
  it('writes the cause, the input, the outcome and the seat of the actor, once', () => {
    const ctx = setup();
    send(ctx, 'Anna', { type: 'build', planet: 'p1_1_5', key: 'metal' });
    const [e, ...rest] = journal(ctx);
    expect(rest).toEqual([]);
    expect(e).toMatchObject({
      seat: 1,
      at: ctx.now(),
      recorded: ctx.now(),
      version: 1,
    });
    const p = e!.payload as unknown as JournalAction;
    expect(p).toMatchObject({
      cause: 'build',
      input: { planet: 'p1_1_5', key: 'metal' },
      ok: true,
    });
    // The queue the action started is the game result; the journal changed nothing there.
    expect(ctx.planets.get('p1_1_5')!.bq).toMatchObject({
      key: 'metal',
      lvl: 4,
    });
  });

  it('records an action that only reads, and one of the admin', () => {
    const ctx = setup();
    send(ctx, 'Bert', { type: 'read' });
    send(ctx, 'Anna', { type: 'closeRound' });
    expect(
      journal(ctx).map((e) => (e.payload as { cause: string }).cause),
    ).toEqual(['read']);
    // The close freezes the round: the admin's own event is not part of it.
    expect(ctx.rounds.get(1)!.status).toBe('closed');
  });

  it('records a refused action as refused, with the message, and the game stays as it was', () => {
    const ctx = setup();
    const before = JSON.stringify(ctx.planets.get('p1_2_6'));
    expect(() =>
      send(ctx, 'Bert', { type: 'build', planet: 'p1_2_6', key: 'metal' }),
    ).not.toThrow();
    const poor = addPlanet(ctx, 'u_Bert', {
      g: 1,
      s: 3,
      p: 7,
      res: { m: 0, c: 0, d: 0 },
    });
    expect(() =>
      send(ctx, 'Bert', { type: 'build', planet: poor.id, key: 'metal' }),
    ).toThrow('Der Zehnte reicht nicht aus.');
    const refused = journal(ctx).filter(
      (e) => !(e.payload as unknown as JournalAction).ok,
    );
    expect(refused).toHaveLength(1);
    expect(refused[0]!.payload).toMatchObject({
      cause: 'build',
      input: { planet: poor.id, key: 'metal' },
      ok: false,
      msg: 'Der Zehnte reicht nicht aus.',
    });
    expect(ctx.planets.get(poor.id)!.bq).toBeNull();
    expect(JSON.stringify(ctx.planets.get('p1_2_6'))).not.toBe(before);
  });

  it('records neither an unknown action nor a request of an unknown account', () => {
    const ctx = setup();
    expect(() => send(ctx, 'Anna', { type: 'nope' })).toThrow();
    expect(() => runAction(ctx, 'nobody', { type: 'read' })).toThrow();
    expect(journal(ctx)).toEqual([]);
  });

  it('writes nothing in a closed round and nothing without an active round', () => {
    const ctx = setup();
    closeActiveRound(ctx);
    const count = ctx.rounds.countEvents(1);
    send(ctx, 'Bert', { type: 'read' });
    expect(() => send(ctx, 'Bert', { type: 'build', planet: 'zz' })).toThrow();
    expect(ctx.rounds.countEvents(1)).toBe(count);
    const other = setup();
    other.db.exec('DELETE FROM rounds');
    send(other, 'Bert', { type: 'read' });
    expect(
      other.db.prepare('SELECT COUNT(*) FROM round_events').pluck().get(),
    ).toBe(0);
  });

  it('does not use the clock or the random generator', () => {
    const a = setup();
    const b = setup();
    b.db.exec("UPDATE rounds SET status = 'closed'");
    for (const ctx of [a, b])
      send(ctx, 'Anna', { type: 'build', planet: 'p1_1_5', key: 'crystal' });
    expect(a.rng()).toBe(b.rng());
    expect(a.planets.get('p1_1_5')).toEqual(b.planets.get('p1_1_5'));
  });
});

describe('no secret and no free text in any row', () => {
  it('never stores the password of the abandon action, also when it is refused', () => {
    const ctx = setup();
    expect(() =>
      send(ctx, 'Bert', {
        type: 'abandon',
        target: 'p1_2_6',
        created: 1,
        password: 'hunter2-secret',
      }),
    ).toThrow();
    const rows = journal(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({
      cause: 'abandon',
      input: { target: 'p1_2_6', created: 1 },
      ok: false,
    });
    expect(everything(ctx)).not.toContain('hunter2');
  });

  it('keeps only the length of a free text and names no account', () => {
    const ctx = setup();
    send(ctx, 'Anna', { type: 'rename', planet: 'p1_1_5', name: 'Zorbalon' });
    expect(() =>
      send(ctx, 'Anna', {
        type: 'createGuild',
        tag: 'ZZZ',
        name: 'Geheimbund',
        description: 'streng vertraulich',
      }),
    ).not.toThrow();
    expect(() =>
      send(ctx, 'Anna', { type: 'sendGuildChat', text: 'Passwort ist rot' }),
    ).not.toThrow();
    const all = everything(ctx);
    for (const text of [
      'Zorbalon',
      'Geheimbund',
      'vertraulich',
      'Passwort',
      'ZZZ',
    ])
      expect(all).not.toContain(text);
    const guild = journal(ctx).find(
      (e) => (e.payload as { cause: string }).cause === 'createGuild',
    )!;
    expect((guild.payload as { input: unknown }).input).toEqual({
      tag: 3,
      name: 10,
      description: 18,
    });
  });

  it('writes the seat of an account, never its id or its name', () => {
    const ctx = setup();
    expect(() =>
      send(ctx, 'Anna', { type: 'requestFriend', name: 'Bert' }),
    ).not.toThrow();
    send(ctx, 'Bert', { type: 'answerFriend', uid: 'u_Anna', accept: true });
    const [ask, answer] = journal(ctx).map(
      (e) => e.payload as unknown as JournalAction,
    );
    expect(ask!.input).toEqual({ name: ctx.rounds.seatOf(1, 'u_Bert') });
    expect(answer!.input).toEqual({
      uid: ctx.rounds.seatOf(1, 'u_Anna'),
      accept: true,
    });
    const all = everything(ctx);
    for (const x of ['u_Anna', 'u_Bert', 'Anna', 'Bert'])
      expect(all).not.toContain(x);
  });

  it('does not let a refusal quote what the player typed', () => {
    const ctx = setup();
    journalRefusal(
      ctx,
      'u_Anna',
      'requestFriend',
      { type: 'requestFriend', name: 'Zorro' },
      'Es gibt keinen Spieler Zorro.',
    );
    expect(journal(ctx)[0]!.payload).toMatchObject({
      msg: 'Es gibt keinen Spieler ….',
    });
  });

  it('does not let a refusal name an account either', () => {
    const ctx = setup();
    journalRefusal(
      ctx,
      'u_Anna',
      'requestFriend',
      { type: 'requestFriend', name: 'Bert' },
      'Bert hat dir bereits eine Anfrage geschickt.',
    );
    expect(journal(ctx)[0]!.payload).toMatchObject({
      msg: '… hat dir bereits eine Anfrage geschickt.',
    });
  });

  it('stores a long or deep value as its size and only the scalars of the rules of a round', () => {
    const ctx = setup();
    const seat = (): number | null => null;
    expect(
      inputOf(ctx, seat, 'send', {
        type: 'send',
        ships: { lf: 1 },
        planet: 'x'.repeat(100),
        cargo: Object.fromEntries(
          Array.from({ length: 80 }, (_, i) => [`key${i}`, i]),
        ),
      }),
    ).toEqual({ ships: { lf: 1 }, planet: { len: 100 }, cargo: { size: 861 } });
    expect(
      inputOf(ctx, seat, 'reset', {
        type: 'reset',
        a: 1,
        b: true,
        c: 'x',
        d: {},
      }),
    ).toEqual({ a: 1, b: true });
    expect(inputOf(ctx, seat, 'nope', { type: 'nope', a: 1 })).toEqual({});
  });
});

/** The names a module reads from the input of an action: `d.name` and `data.name`. */
function fieldsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/\b(?:d|data)\.([a-zA-Z]+)\b/g)].map((m) => m[1]!);
}

describe('the guard: every action and every input field is classified', () => {
  it('has an entry for every action and none for an action that is gone', () => {
    expect(Object.keys(INPUT).sort()).toEqual(Object.keys(ACTIONS).sort());
  });

  it('lists every field a module of the actions reads from its input', () => {
    const files = [
      'src/server/game/actions.ts',
      'src/server/push-options.ts',
      ...SERVER_FEATURES.map(([name]) => `src/server/${name}.ts`),
    ];
    const classified = new Set(
      Object.values(INPUT).flatMap((s) =>
        s === 'scalars' ? [] : Object.keys(s),
      ),
    );
    // Not an input of an action: the state and the settings that share a name in the same file.
    const other = new Set([
      'settings',
      'type',
      'cost',
      'activeMs',
      'actions',
      'day',
      'ms',
      'scan',
      // Deliberately never stored: the password of the abandon action.
      'password',
    ]);
    const missing = files.flatMap((f) =>
      fieldsOf(f)
        .filter((x) => !classified.has(x) && !other.has(x))
        .map((x) => `${f}: ${x}`),
    );
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('one event per arrival and return', () => {
  const fleet = (ctx: TestCtx, over: Partial<Fleet> = {}): Fleet => {
    const f: Fleet = {
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_2_6',
      toC: { g: 1, s: 2, p: 6 },
      mission: 'attack',
      ships: { lf: 20 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now() - 1000,
      arr: ctx.now() - 500,
      ret: ctx.now() + 100,
      state: 'out',
      recalled: false,
      fuel: 0,
      ...over,
    };
    ctx.fleets.save(f);
    return f;
  };

  it('writes the arrival at its logical time with the reports, the battle once, the seats', () => {
    const ctx = setup();
    fleet(ctx);
    tick(ctx);
    const [e, ...rest] = journal(ctx, EVENT_KIND.arrival);
    expect(rest).toEqual([]);
    expect(e).toMatchObject({
      seat: 1,
      at: ctx.now() - 500,
      recorded: ctx.now(),
    });
    const p = e!.payload as unknown as JournalFleet;
    expect(p).toMatchObject({
      cause: 'arrival',
      mission: 'attack',
      fleet: 'f1',
      from: 'p1_1_5',
      to: 'p1_2_6',
      target: 2,
      ships: { lf: 20 },
    });
    // Both sides got a report; the facts of the battle are copied once.
    expect(p.reports!.map((r) => [r.type, r.to]).sort()).toEqual([
      ['battle', 1],
      ['battle', 2],
    ]);
    expect(p.battle).toMatchObject({
      winner: expect.any(String),
      attBefore: { lf: 20 },
    });
    expect(p.fate === 'back' || p.fate === 'gone').toBe(true);
    // The names of the report are not in the event.
    expect(everything(ctx)).not.toContain('Alpha');
    // A second tick processes nothing and writes nothing.
    const count = ctx.rounds.countEvents(1);
    tick(ctx);
    expect(ctx.rounds.countEvents(1)).toBe(count);
  });

  it('writes the return of a fleet at its return time', () => {
    const ctx = setup();
    fleet(ctx, {
      mission: 'transport',
      state: 'back',
      ret: ctx.now() - 10,
      cargo: { m: 5, c: 0, d: 0 },
    });
    tick(ctx);
    const [e] = journal(ctx, EVENT_KIND.return);
    expect(e).toMatchObject({ seat: 1, at: ctx.now() - 10 });
    expect(e!.payload).toMatchObject({
      cause: 'return',
      fleet: 'f1',
      cargo: { m: 5, c: 0, d: 0 },
      fate: 'gone',
    });
  });

  it('writes nothing in a closed round, and the fleet is processed the same', () => {
    const ctx = setup();
    closeActiveRound(ctx);
    const count = ctx.rounds.countEvents(1);
    fleet(ctx);
    tick(ctx);
    expect(ctx.rounds.countEvents(1)).toBe(count);
    expect(ctx.fleets.get('f1')?.state ?? 'gone').not.toBe('out');
  });
});

describe('what the places produced', () => {
  const HOUR = 3600000;

  it('records the stock a saved span credited, once, at the save that advanced the place', () => {
    const ctx = setup();
    const start = ctx.planets.get('p1_1_5')!;
    ctx.clock.t += 2 * HOUR;
    send(ctx, 'Anna', { type: 'read' });
    // `read` saved nothing: nothing produced is recorded.
    expect(journal(ctx)[0]!.payload).not.toHaveProperty('prod');
    send(ctx, 'Anna', { type: 'build', planet: 'p1_1_5', key: 'metal' });
    const p = journal(ctx)[1]!.payload as unknown as JournalAction;
    expect(p.prod).toHaveLength(1);
    const made = p.prod![0]!;
    const saved = ctx.planets.get('p1_1_5')!;
    expect(made).toMatchObject({
      place: 'p1_1_5',
      owner: 1,
      from: start.t,
      to: ctx.now(),
    });
    // The stock now is what the span credited minus what the building cost.
    const cost = saved.bq!.cost;
    expect(saved.res.m).toBeCloseTo(start.res.m + made.m - cost[0], 1);
    expect(made.m).toBeGreaterThan(0);
    // The same span is not recorded again.
    send(ctx, 'Anna', { type: 'pct', planet: 'p1_1_5', key: 'metal', v: 90 });
    const again = journal(ctx).at(-1)!.payload as unknown as JournalAction;
    expect(again.prod ?? []).toEqual([]);
  });

  it('records a finished building at its logical end with the cost it had', () => {
    const ctx = setup();
    send(ctx, 'Anna', { type: 'build', planet: 'p1_1_5', key: 'metal' });
    const q = ctx.planets.get('p1_1_5')!.bq!;
    ctx.clock.t = q.end + HOUR;
    send(ctx, 'Anna', { type: 'pct', planet: 'p1_1_5', key: 'metal', v: 100 });
    const p = journal(ctx).at(-1)!.payload as unknown as JournalAction;
    expect(p.prod![0]!.built).toEqual({
      key: 'metal',
      lvl: q.lvl,
      end: q.end,
      cost: [...q.cost],
    });
    expect(ctx.planets.get('p1_1_5')!.b.metal).toBe(q.lvl);
  });

  it('records the units the shipyard finished', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', {
      g: 1,
      s: 1,
      p: 6,
      b: { yard: 1 },
      res: { m: 5000, c: 0, d: 0 },
    });
    send(ctx, 'Anna', { type: 'order', planet: 'p1_1_6', key: 'rl', n: 3 });
    ctx.clock.t += 24 * HOUR;
    send(ctx, 'Anna', { type: 'read' });
    send(ctx, 'Anna', { type: 'pct', planet: 'p1_1_6', key: 'metal', v: 100 });
    const p = journal(ctx).at(-1)!.payload as unknown as JournalAction;
    expect(p.prod![0]!.units).toEqual({ rl: 2 });
  });

  it('writes no production for a read and none when the action is refused', () => {
    const ctx = setup();
    ctx.clock.t += HOUR;
    expect(() =>
      send(ctx, 'Anna', { type: 'build', planet: 'p1_1_5', key: 'nope' }),
    ).toThrow();
    const e = journal(ctx).at(-1)!.payload as unknown as JournalAction;
    expect(e.ok).toBe(false);
    expect(e).not.toHaveProperty('prod');
  });
});
