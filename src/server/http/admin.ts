import { audited, auditPage, type AuditEntry } from '../audit.ts';
import type { User } from '../db/repos/players.ts';
import { errorExport, exportRange } from '../error-export.ts';
import { errorPage } from '../error-log.ts';
import { announce, requireAdmin } from '../game/admin.ts';
import { type Ctx, fail, str } from '../game/context.ts';
import { orders, playerDetail, playerStats } from '../game/diagnostics.ts';
import { moderate } from '../game/moderation.ts';
import { stateFor } from '../game/state.ts';
import type { AppDeps, Call, Handler } from './app.ts';

type AdminWork = (call: Call, user: User) => ReturnType<Handler>;

export function adminRoutes(
  d: AppDeps,
  sessionUser: (call: Call) => User,
  invite: AdminWork,
): Record<string, Handler> {
  const { ctx } = d;
  const admin =
    (work: (call: Call, u: User) => ReturnType<Handler>): Handler =>
    (call) => {
      const u = sessionUser(call);
      requireAdmin(u);
      return work(call, u);
    };
  const read = (
    action: string,
    work: (entry: AuditEntry, call: Call) => object,
  ): Handler =>
    admin((call, u) => {
      const entry: AuditEntry = {
        category: 'admin.read',
        action,
        actor: u.id,
        requestId: call.requestId,
      };
      return { json: audited(ctx, entry, () => work(entry, call)) };
    });

  return {
    ...diagnosticRoutes(ctx, read),
    ...errorLogRoutes(ctx, read, admin),
    ...moderationRoutes(d, admin, invite),
  };
}

type Read = (
  action: string,
  work: (entry: AuditEntry, call: Call) => object,
) => Handler;
type Admin = (work: (call: Call, u: User) => ReturnType<Handler>) => Handler;

function diagnosticRoutes(ctx: Ctx, read: Read): Record<string, Handler> {
  return {
    'POST /api/admin/invitations': read('invitations', () => ({
      invitations: ctx.invitations
        .open(ctx.now())
        .map(({ id, email, created, expires }) => ({
          id,
          email,
          created,
          expires,
        })),
    })),
    'POST /api/admin/stats': read('stats', () => ({
      players: playerStats(ctx),
    })),
    'POST /api/admin/orders': read('orders', (entry, { body }) => {
      entry.target = str(body.player, 40) || null;
      const reference = str(body.reference, 40);
      entry.detail = { reference };
      return {
        orders: orders(ctx, entry.target ?? '', reference),
        now: ctx.now(),
      };
    }),
    'POST /api/admin/events': read('events', (entry, { body }) => {
      const { filter, result } = auditPage(ctx, body);
      entry.target = filter.player || null;
      entry.detail = { ...filter, page: result.page, limit: result.limit };
      return result;
    }),
    'POST /api/admin/player': read('player', (entry, { body }) => {
      entry.target = str(body.player, 40);
      if (!ctx.players.get(entry.target)) fail('Spieler nicht gefunden.');
      return playerDetail(ctx, entry.target);
    }),
  };
}

/** The admin tab „Fehler“ and its download (issue #126), both admin reads. */
function errorLogRoutes(
  ctx: Ctx,
  read: Read,
  admin: Admin,
): Record<string, Handler> {
  return {
    'POST /api/admin/errors': read('errors', (entry, { body }) => {
      const { filter, result } = errorPage(ctx, body);
      entry.detail = { kind: filter.kind, page: result.page };
      return result;
    }),
    'POST /api/admin/errors/download': admin((call, u) => {
      const range = exportRange(call.body, ctx.now());
      const entry: AuditEntry = {
        category: 'admin.read',
        action: 'errorDownload',
        actor: u.id,
        requestId: call.requestId,
      };
      const { name, zip } = audited(ctx, entry, () => {
        const result = errorExport(ctx, range);
        entry.detail = { ...range, ...result.counts };
        return result;
      });
      return { file: { type: 'application/zip', name, body: zip } };
    }),
  };
}

function moderationRoutes(
  d: AppDeps,
  admin: Admin,
  invite: AdminWork,
): Record<string, Handler> {
  const { ctx } = d;
  return {
    'POST /api/admin/invite': admin(invite),
    'POST /api/admin/revoke': admin((call, u) => {
      const id = str(call.body.id, 40);
      const entry = {
        category: 'admin.write',
        action: 'revoke',
        actor: u.id,
        requestId: call.requestId,
        detail: { invitation: id },
      } as const;
      audited(ctx, entry, () => {
        if (!id || !ctx.invitations.revoke({ id }, ctx.now()))
          fail('Einladung nicht gefunden oder bereits widerrufen.');
      });
      return {
        json: {
          ok: true,
          msg: 'Einladung widerrufen.',
          state: stateFor(ctx, u),
        },
      };
    }),
    'POST /api/admin/announce': announcement(ctx, admin),
    'POST /api/admin/moderate': admin((call, u) => {
      const action = String(call.body.action);
      if (!['ban', 'unban', 'revokeSessions'].includes(action))
        fail('Unbekannte Aktion.');
      const entry: AuditEntry = {
        category: 'admin.write',
        action,
        actor: u.id,
        target: str(call.body.player, 40),
        requestId: call.requestId,
      };
      audited(ctx, entry, () => moderate(ctx, u, call.body, entry));
      return { json: { ok: true } };
    }),
  };
}

function announcement(ctx: Ctx, admin: Admin): Handler {
  return admin((call, u) => {
    const entry: AuditEntry = {
      category: 'admin.write',
      action: 'announce',
      actor: u.id,
      requestId: call.requestId,
    };
    const recipients = audited(ctx, entry, () => {
      const count = announce(ctx, call.body.message);
      entry.detail = { recipients: count };
      return count;
    });
    return { json: { recipients } };
  });
}
