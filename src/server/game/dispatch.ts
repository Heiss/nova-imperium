// The list of actions a player can send and how one is run: first all due
// fleets, then the action, everything in one transaction.
import type { AuditEntry } from '../audit.ts';
import type { User } from '../db/store.ts';
import * as A from './actions.ts';
import { reset, saveSettings } from './admin.ts';
import { tick } from './arrival.ts';
import { type Ctx, fail } from './context.ts';
import { recall, send } from './fleet-actions.ts';

export const ACTIONS: Record<string, A.Action> = {
  build: A.build,
  cancelBuild: A.cancelBuild,
  research: A.research,
  cancelResearch: A.cancelResearch,
  order: A.order,
  pct: A.pct,
  rename: A.rename,
  options: A.options,
  read: A.read,
  delrep: A.delrep,
  delall: A.delall,
  send,
  recall,
  settings: saveSettings,
  reset,
};

export function runAction(
  ctx: Ctx,
  uid: string,
  d: A.Data,
  event?: AuditEntry,
): string | null {
  const type = String(d.type);
  const fn = Object.hasOwn(ACTIONS, type)
    ? ACTIONS[type]!
    : fail('Unbekannte Aktion.');
  return ctx.store.tx(() => {
    tick(ctx);
    const u: User = ctx.store.user(uid) ?? fail('Bitte einloggen.');
    return fn(ctx, u, d, event);
  });
}
