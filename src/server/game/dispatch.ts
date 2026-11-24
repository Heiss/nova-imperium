// The list of actions a player can send and how one is run: first all due
// fleets, then the action, everything in one transaction.
import type { AuditEntry } from '../audit.ts';
import { recordAchievementAction } from './achievements.ts';
import type { User } from '../db/repos/players.ts';
import * as A from './actions.ts';
import { tick } from './arrival.ts';
import { assembleActions, gatedBy } from './assemble.ts';
import type { Handlers } from './feature.ts';
import { SERVER_FEATURES } from '../features.gen.ts';
import { type Ctx, fail, GameError } from './context.ts';
import {
  beginCause,
  dropCause,
  journalAction,
  journalRefusal,
} from './journal.ts';
import { GUILDS_OFF, roundRules } from './round.ts';
import { vacationRefuses } from '../../core/vacation.ts';
import { VACATION_REFUSED } from './vacation.ts';

/**
 * The actions of the core game: the queues of a planet, its name and shares,
 * the display options and the reports. Every other action is registered by
 * its module as `serverFeature`, with its group (admin) and its switch, and added
 * here by `assembleActions` (#326, okf/architecture/patterns.md, section 14).
 */
const FRAME = {
  build: A.build,
  cancelBuild: A.cancelBuild,
  research: A.research,
  cancelResearch: A.cancelResearch,
  order: A.order,
  cancelOrder: A.cancelOrder,
  pct: A.pct,
  rename: A.rename,
  options: A.options,
  read: A.read,
  delrep: A.delrep,
  delall: A.delall,
} satisfies Handlers;

const tables = assembleActions(FRAME, SERVER_FEATURES);

export const ACTIONS: Record<string, A.Action> = tables.actions;

/** The switches of the actions of features that can be off in a round (#374). */
const GATES = tables.gates;

/** The guild actions: those refused while guilds are off in the round (#191), read from the switches. */
export const GUILD_ACTIONS: ReadonlySet<string> = gatedBy(GATES, GUILDS_OFF);

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
  try {
    return ctx.tx(() => run(ctx, uid, type, fn, d, event));
  } catch (e) {
    // A refused action rolled back; the journal of the round keeps the refusal (#235).
    if (e instanceof GameError) journalRefusal(ctx, uid, type, d, e.message);
    else dropCause();
    throw e;
  }
}

function run(
  ctx: Ctx,
  uid: string,
  type: string,
  fn: A.Action,
  d: A.Data,
  event?: AuditEntry,
): string | null | A.Answer {
  tick(ctx);
  beginCause();
  const u: User = ctx.players.get(uid) ?? fail('Bitte einloggen.');
  // Nothing but the end, the push settings and the private messages during
  // the vacation mode (#223; the messages since Q25, Q28, #226).
  if (vacationRefuses(type, u.vacation)) fail(VACATION_REFUSED);
  // An action of a feature that is off in the round (#191, #374).
  const gate = GATES[type];
  if (gate && !gate.enabled(roundRules(ctx))) fail(gate.off);
  const result = fn(ctx, u, d, event);
  recordAchievementAction(ctx, uid, type);
  journalAction(ctx, u, type, d);
  return result;
}
