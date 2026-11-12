import { passwordMatches } from './auth.ts';
import type { User } from './db/store.ts';
import { coords, type Ctx, fail } from './game/context.ts';

// Spy activity reports stored before the grimdark naming (#94) keep their
// classic title, so both titles are matched. Battle reports are matched by
// the names in their body, whatever their title says.
function removeLinkedReports(ctx: Ctx, user: User): void {
  const db = ctx.store.db;
  const reports = db
    .prepare(
      `
    DELETE FROM reports
    WHERE EXISTS (SELECT 1 FROM json_each(body, '$.participants') WHERE value = @id)
      OR json_extract(body, '$.attName') = @name
      OR json_extract(body, '$.defName') = @name
      OR (type = 'info' AND (
        title = 'Lieferung von ' || @name
        OR (title IN ('Auspex-Aktivität', 'Spionageaktivität') AND instr(json_extract(body, '$.text'),
          'Eine fremde Flotte von ' || @name || ' [') = 1)
      ))
    RETURNING id
  `,
    )
    .all({ id: user.id, name: user.name }) as { id: string }[];

  const deleteTransport = db.prepare(`
    DELETE FROM reports WHERE type = 'info'
      AND title = 'Transport erreicht ' || ?
      AND instr(json_extract(body, '$.text'), ' ' || ? || ' und liefert ') > 0
    RETURNING id
  `);
  for (const planet of ctx.store.planets().filter((p) => p.owner === user.id)) {
    const position = coords(planet);
    reports.push(
      ...(deleteTransport.all(position, position) as { id: string }[]),
    );
  }
  const removePush = db.prepare(
    "DELETE FROM push_jobs WHERE kind = 'messages' AND event_key = ?",
  );
  for (const report of reports) removePush.run(report.id);
}

function detachIncomingFleets(ctx: Ctx, user: User): void {
  const now = ctx.now();
  ctx.store.db
    .prepare(
      `
    UPDATE fleets SET state = 'back',
      ret = CASE WHEN state = 'out' THEN ? + max(0, min(?, arr) - dep) ELSE ret END,
      recalled = CASE WHEN state = 'out' THEN 1 ELSE recalled END,
      to_planet = from_planet, to_g = from_g, to_s = from_s, to_p = from_p
    WHERE owner != ? AND to_planet IN (SELECT id FROM planets WHERE owner = ?)
  `,
    )
    .run(now, now, user.id, user.id);
}

export function deleteAccount(ctx: Ctx, user: User, password: unknown): void {
  if (typeof password !== 'string' || !passwordMatches(user, password))
    fail('Das bisherige Passwort ist falsch.');
  ctx.store.tx(() => {
    const db = ctx.store.db;
    detachIncomingFleets(ctx, user);
    removeLinkedReports(ctx, user);
    db.prepare('DELETE FROM guilds WHERE founder = ?').run(user.id);
    db.prepare('DELETE FROM invitations WHERE email = ?').run(user.email);
    db.prepare('DELETE FROM audit_events WHERE actor = ? OR target = ?').run(
      user.id,
      user.id,
    );
    db.prepare(
      `
      DELETE FROM passkey_challenges WHERE session_hash IN (
        SELECT token_hash FROM sessions WHERE user_id = ?
      )
    `,
    ).run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
}
