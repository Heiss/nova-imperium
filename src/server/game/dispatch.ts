// The list of actions a player can send and how one is run: first all due
// fleets, then the action, everything in one transaction.
import type { AuditEntry } from '../audit.ts';
import { recordAchievementAction } from './achievements.ts';
import type { User } from '../db/repos/players.ts';
import * as A from './actions.ts';
import { tick } from './arrival.ts';
import { assembleActions } from './assemble.ts';
import { SERVER_FEATURES } from '../features.gen.ts';
import { type Ctx, fail } from './context.ts';
import { requireGuilds } from './round.ts';
import { deleteGuildChat, seeGuildChat, sendGuildChat } from './guild-chat.ts';
import { vacationRefuses } from '../../core/vacation.ts';
import { VACATION_REFUSED } from './vacation.ts';
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
  seeGuildChat,
};

/**
 * The actions of the core game; a feature adds its own as `serverFeature`
 * in its module (#326, okf/architecture/patterns.md, section 14).
 */
const FRAME: Record<string, A.Action> = {
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
  ...GUILD,
};

const tables = assembleActions(FRAME, SERVER_FEATURES);

export const ACTIONS: Record<string, A.Action> = tables.actions;

export const GUILD_ACTIONS: ReadonlySet<string> = new Set([
  ...Object.keys(GUILD),
  ...tables.guild,
]);

/** The actions of the admin: audited as `admin.write`, not as `game`. */
export const ADMIN_ACTIONS: ReadonlySet<string> = tables.admin;

export function runAction(
  ctx: Ctx,
  uid: string,
  d: A.Data,
  event?: AuditEntry,
): string | null | A.Answer {
  const type = String(d.type);
  const fn = Object.hasOwn(ACTIONS, type)
    ? ACTIONS[type]!
    : fail('Unbekannte Aktion.');
  return ctx.tx(() => {
    tick(ctx);
    const u: User = ctx.players.get(uid) ?? fail('Bitte einloggen.');
    // Nothing but the end and the push settings during the vacation mode (#223).
    if (vacationRefuses(type, u.vacation)) fail(VACATION_REFUSED);
    if (GUILD_ACTIONS.has(type)) requireGuilds(ctx);
    const result = fn(ctx, u, d, event);
    recordAchievementAction(ctx, uid, type);
    return result;
  });
}
