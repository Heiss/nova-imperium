import { describe, expect, it } from 'vitest';
import type { Fleet } from '../shared/types.ts';
import { deleteAccount } from './delete-account.ts';
import { GameError } from './game/context.ts';
import { addPlanet, addUser, testCtx } from './test-helpers.ts';

function setup() {
  const ctx = testCtx();
  const gone = addUser(ctx, 'Gone');
  const stay = addUser(ctx, 'Stay');
  const home = addPlanet(ctx, gone.id, { p: 4 });
  const other = addPlanet(ctx, stay.id, { p: 9 });
  return { ctx, gone, stay, home, other };
}

const transport = (id: string, at: string) => ({
  id,
  time: 1,
  type: 'info' as const,
  title: `Transport erreicht ${at}`,
  text: `Deine Flotte erreicht ${at} und liefert 10 Metall.`,
});

function fleet(over: Partial<Fleet>): Fleet {
  return {
    id: 'f',
    owner: 'u_Stay',
    from: 'p1_1_9',
    fromC: { g: 1, s: 1, p: 9 },
    to: 'p1_1_4',
    toC: { g: 1, s: 1, p: 4 },
    mission: 'transport',
    ships: { kt: 1 },
    cargo: { m: 0, c: 0, d: 0 },
    dep: 1_000_000 - 100,
    arr: 1_000_000 + 500,
    ret: 1_000_000 + 1100,
    state: 'out',
    recalled: false,
    ...over,
  };
}

describe('deleteAccount', () => {
  it('refuses a wrong or missing password and keeps the account', () => {
    const { ctx, gone } = setup();
    for (const password of ['wrong', undefined, 7]) {
      expect(() => deleteAccount(ctx, gone, password)).toThrow(
        new GameError('Das bisherige Passwort ist falsch.'),
      );
    }
    expect(ctx.store.user(gone.id)).not.toBeNull();
  });

  it('removes transport reports to its own planets only, with their push jobs', () => {
    const { ctx, gone, stay, home, other } = setup();
    ctx.store.addReport(stay.id, transport('to-gone', '[1:1:4]'), 10);
    ctx.store.addReport(stay.id, transport('to-stay', '[1:1:9]'), 10);
    const db = ctx.store.db;
    db.prepare("INSERT INTO push_subscriptions VALUES ('e', ?, 'k', 'a')").run(
      stay.id,
    );
    const job = db.prepare(
      "INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at) VALUES ('e', ?, ?, 0, 0)",
    );
    job.run('messages', 'to-gone');
    job.run('messages', 'to-stay');
    job.run('fleets', 'to-gone');
    expect(home.p).toBe(4);
    expect(other.p).toBe(9);

    deleteAccount(ctx, gone, 'secret1');

    expect(ctx.store.reports(stay.id).map((r) => r.id)).toEqual(['to-stay']);
    expect(
      db.prepare('SELECT kind, event_key FROM push_jobs ORDER BY kind').all(),
    ).toEqual([
      { kind: 'fleets', event_key: 'to-gone' },
      { kind: 'messages', event_key: 'to-stay' },
    ]);
  });

  it('removes its spy and battle reports under the old and the new titles (#94)', () => {
    const { ctx, gone, stay } = setup();
    const spy = (id: string, title: string, name: string) => ({
      id,
      time: 1,
      type: 'info' as const,
      title,
      text: `Eine fremde Flotte von ${name} [1:1:4] wurde in der Nähe deines Planeten Heim [1:1:9] gesichtet.`,
    });
    const battle = (id: string, title: string, attName: string) => ({
      id,
      time: 1,
      type: 'battle' as const,
      title,
      attName,
      defName: 'Stay',
    });
    // Reports stored before the grimdark naming keep their classic titles.
    ctx.store.addReport(
      stay.id,
      spy('old-spy', 'Spionageaktivität', 'Gone'),
      10,
    );
    ctx.store.addReport(
      stay.id,
      spy('new-spy', 'Auspex-Aktivität', 'Gone'),
      10,
    );
    ctx.store.addReport(
      stay.id,
      spy('other-spy', 'Auspex-Aktivität', 'Else'),
      10,
    );
    ctx.store.addReport(
      stay.id,
      spy('other-title', 'Lieferung von Else', 'Gone'),
      10,
    );
    ctx.store.addReport(
      stay.id,
      battle('old-hit', 'Angriff auf Heim [1:1:9] durch Gone', 'Gone'),
      10,
    );
    ctx.store.addReport(
      stay.id,
      battle(
        'new-hit',
        'Feindkontakt! Heim [1:1:9] wird von Gone angegriffen',
        'Gone',
      ),
      10,
    );

    deleteAccount(ctx, gone, 'secret1');

    expect(
      ctx.store
        .reports(stay.id)
        .map((r) => r.id)
        .sort(),
    ).toEqual(['other-spy', 'other-title']);
  });

  it('sends fleets on their way to its planets home', () => {
    const { ctx, gone } = setup();
    const now = ctx.now();
    ctx.store.saveFleet(fleet({ id: 'out' }));
    ctx.store.saveFleet(
      fleet({ id: 'late', dep: now - 900, arr: now - 100, ret: now + 9000 }),
    );
    ctx.store.saveFleet(
      fleet({ id: 'back', state: 'back', ret: now + 700, recalled: false }),
    );
    ctx.store.saveFleet(
      fleet({ id: 'elsewhere', to: 'p1_1_9', toC: { g: 1, s: 1, p: 9 } }),
    );

    deleteAccount(ctx, gone, 'secret1');

    const out = ctx.store.fleet('out')!;
    expect(out).toMatchObject({
      state: 'back',
      recalled: true,
      ret: now + 100,
      to: 'p1_1_9',
      toC: { g: 1, s: 1, p: 9 },
    });
    expect(ctx.store.fleet('late')).toMatchObject({
      state: 'back',
      ret: now + 800,
    });
    expect(ctx.store.fleet('back')).toMatchObject({
      state: 'back',
      recalled: false,
      ret: now + 700,
      to: 'p1_1_9',
    });
    expect(ctx.store.fleet('elsewhere')).toMatchObject({
      state: 'out',
      ret: now + 1100,
    });
  });

  it('removes its invitations, audit entries and passkey challenges', () => {
    const { ctx, gone, stay } = setup();
    const db = ctx.store.db;
    const count = (sql: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get() as { n: number }).n;
    db.prepare(
      'INSERT INTO invitations (id, email, token_hash, created_by, created, expires) VALUES (?, ?, ?, NULL, 0, 9)',
    ).run('i1', gone.email, 'h1');
    db.prepare(
      'INSERT INTO invitations (id, email, token_hash, created_by, created, expires) VALUES (?, ?, ?, NULL, 0, 9)',
    ).run('i2', stay.email, 'h2');
    const audit = db.prepare(
      "INSERT INTO audit_events (time, actor, category, action, outcome, target, detail) VALUES (0, ?, 'c', 'a', 'ok', ?, '{}')",
    );
    audit.run(gone.id, stay.id);
    audit.run(stay.id, gone.id);
    audit.run(stay.id, stay.id);
    const session = db.prepare('INSERT INTO sessions VALUES (?, ?, 9e9)');
    session.run('s-gone', gone.id);
    session.run('s-stay', stay.id);
    const challenge = db.prepare(
      "INSERT INTO passkey_challenges VALUES (?, 'c', ?, 9e9)",
    );
    challenge.run('c-gone', 's-gone');
    challenge.run('c-stay', 's-stay');
    challenge.run('c-login', null);

    deleteAccount(ctx, gone, 'secret1');

    expect(count('invitations')).toBe(1);
    expect(count('audit_events')).toBe(1);
    expect(
      db.prepare('SELECT id FROM passkey_challenges ORDER BY id').all(),
    ).toEqual([{ id: 'c-login' }, { id: 'c-stay' }]);
    expect(ctx.store.user(gone.id)).toBeNull();
    expect(ctx.store.user(stay.id)).not.toBeNull();
  });
});
