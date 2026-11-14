// The list of actions a player can send and how one is run: first all due
// fleets, then the action, everything in one transaction.
import type { AuditEntry } from '../audit.ts';
import {
  claimAchievement,
  claimDailyReward,
  recordAchievementAction,
} from './achievements.ts';
import type { User } from '../db/repos/players.ts';
import * as A from './actions.ts';
import { reset, saveSettings } from './admin.ts';
import { pushOptions } from '../push-options.ts';
import { tick } from './arrival.ts';
import { type Ctx, fail } from './context.ts';
import { recall, send } from './fleet-actions.ts';
import {
  createGuild,
  updateGuild,
  applyToGuild,
  reviewGuildApplication,
  leaveGuild,
  manageGuildMember,
} from './guilds.ts';

export const ACTIONS: Record<string, A.Action> = {
  build: A.build,
  cancelBuild: A.cancelBuild,
  research: A.research,
  cancelResearch: A.cancelResearch,
  order: A.order,
  pct: A.pct,
  rename: A.rename,
  options: A.options,
  pushOptions,
  read: A.read,
  delrep: A.delrep,
  delall: A.delall,
  send,
  recall,
  settings: saveSettings,
  reset,
  createGuild,
  updateGuild,
  applyToGuild,
  reviewGuildApplication,
  leaveGuild,
  manageGuildMember,
  claimAchievement,
  claimDailyReward,
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
  return ctx.tx(() => {
    tick(ctx);
    const u: User = ctx.players.get(uid) ?? fail('Bitte einloggen.');
    const result = fn(ctx, u, d, event);
    recordAchievementAction(ctx, uid, type);
    return result;
  });
}
