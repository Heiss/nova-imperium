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
import { endzeit } from './endzeit.ts';
import { pushOptions } from '../push-options.ts';
import { tick } from './arrival.ts';
import { type Ctx, fail } from './context.ts';
import { requireGuilds } from './round.ts';
import { deleteGuildChat, sendGuildChat } from './guild-chat.ts';
import { recall, send } from './fleet-actions.ts';
import {
  assignGuildRank,
  createGuildRank,
  deleteGuildRank,
  dissolveGuild,
  moveGuildRank,
  renameGuildRank,
  setGuildDefaultRank,
  setGuildRankRights,
} from './guild-ranks.ts';
import {
  createGuild,
  updateGuild,
  applyToGuild,
  reviewGuildApplication,
  leaveGuild,
  manageGuildMember,
} from './guilds.ts';

/**
 * The guild actions: refused while guilds are off in the round (#191). A
 * new guild action, the chat of #169 included, belongs here.
 */
const GUILD: Record<string, A.Action> = {
  createGuild,
  updateGuild,
  applyToGuild,
  reviewGuildApplication,
  leaveGuild,
  manageGuildMember,
  createGuildRank,
  renameGuildRank,
  setGuildRankRights,
  moveGuildRank,
  deleteGuildRank,
  setGuildDefaultRank,
  assignGuildRank,
  dissolveGuild,
  sendGuildChat,
  deleteGuildChat,
};

export const GUILD_ACTIONS: ReadonlySet<string> = new Set(Object.keys(GUILD));

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
  endzeit,
  ...GUILD,
  claimAchievement,
  claimDailyReward,
};

/** The actions of the admin: audited as `admin.write`, not as `game`. */
export const ADMIN_ACTIONS: ReadonlySet<string> = new Set([
  'settings',
  'reset',
  'endzeit',
]);

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
    if (GUILD_ACTIONS.has(type)) requireGuilds(ctx);
    const result = fn(ctx, u, d, event);
    recordAchievementAction(ctx, uid, type);
    return result;
  });
}
