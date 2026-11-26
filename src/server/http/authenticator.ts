// The routes of the authenticator app (#401, owner, 2026-11-25): the box
// „Authenticator-App“ of „Optionen“ → „Konto“ sets it up and removes it
// (text 4), the page of a reset link asks whether it needs the code of the
// app (text 6, 104); the admin's reset is in http/admin.ts. Every change is
// in the audit log, never the secret.
import { record, type AuditEntry } from '../audit.ts';
import * as authenticator from '../authenticator.ts';
import * as security from '../account-security.ts';
import type { User } from '../db/repos/players.ts';
import { GameError } from '../game/context.ts';
import type { AppDeps, Call, Guard, Handler } from './app.ts';

export function authenticatorRoutes(
  d: AppDeps,
  guard: Guard,
  sessionUser: (call: Call) => User,
): Record<string, Handler> {
  const { ctx } = d;
  /** A change of the own app, audited with its outcome. */
  const own =
    (action: string, work: (call: Call, u: User) => unknown): Handler =>
    (call) => {
      guard(call.req);
      const u = sessionUser(call);
      const entry: AuditEntry = {
        category: 'account',
        action,
        actor: u.id,
        requestId: call.requestId,
      };
      // A wrong code counts against the setup: that write stays when the
      // code is refused, outside a transaction of the audit entry.
      let result: unknown;
      try {
        result = work(call, u);
      } catch (error) {
        record(ctx, entry, error instanceof GameError ? 'rejected' : 'error');
        throw error;
      }
      record(ctx, entry);
      return { json: result ?? { ok: true } };
    };
  return {
    // „Einrichten“: the address of the QR code and the secret, once.
    'POST /api/totp/setup': own('totpSetup', (_call, u) =>
      authenticator.beginSetup(ctx, u),
    ),
    'POST /api/totp/confirm': own('totpConfirm', (call, u) =>
      authenticator.confirmSetup(ctx, u, call.body.code),
    ),
    'POST /api/totp/remove': own('totpRemove', (call, u) =>
      authenticator.removeAuthenticator(
        ctx,
        u,
        call.body.password,
        call.body.code,
      ),
    ),
    'POST /api/password/reset/check': ({ req, body }) => {
      guard(req);
      return { json: { app: security.resetNeedsApp(ctx, body.token) } };
    },
  };
}
