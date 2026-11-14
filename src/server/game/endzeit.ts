// „Endzeit“ (issue #161): the admin sends every player with a home planet a
// gift fleet, once per round. It is a Verlegung from „Gottkaiser“ to the
// home planet (`fleets.gift`): no fleet slot, no fuel, no recall. When it
// arrives, the ships and the cargo land, and the research and the buildings
// of the home planet are raised (src/core/endzeit.ts).
import {
  GIFT_DEFAULT_MINUTES,
  GIFT_MINUTES,
  giftCargo,
  giftLevels,
  giftShips,
  overtaken,
  raise,
} from '../../core/endzeit.ts';
import { refund } from '../../core/economy.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Fleet, Levels, Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import { cancelScheduledPush } from '../push-store.ts';
import type { Action } from './actions.ts';
import { requireAdmin } from './admin.ts';
import { type Ctx, addReport, fail, universe } from './context.ts';
import { land } from './missions.ts';
import { roundRules } from './round.ts';

/** The settings: the round of the last „Endzeit“ and its flight time. */
export const ENDZEIT_ROUND = 'endzeitRound';
export const ENDZEIT_MINUTES = 'endzeitMinutes';

const MINUTE = 60000;

/** The owner's text (D5, owner 2026-11-13), sent at the start. */
export const START_TEXT =
  'Der allwissende Gottkaiser war gnädig und hat die Endzeit eingeläutet. Er möchte sehen, wie ihr ihn unterhaltet, wenn ihr seine Fähigkeiten bekommt.';
/** The message on arrival (owner, 2026-11-14), instead of „Verlegung erreicht“. */
export const ARRIVAL_TEXT = 'Die Gabe des Gottkaisers ist eingetroffen.';

/** What the admin dialog shows: the saved flight time and whether it is used up. */
export function endzeitState(ctx: Ctx): { minutes: number; done: boolean } {
  return {
    minutes: ctx.admin.setting(ENDZEIT_MINUTES) ?? GIFT_DEFAULT_MINUTES,
    done: ctx.admin.setting(ENDZEIT_ROUND) === roundRules(ctx).number,
  };
}

/** The flight time of this trigger: whole minutes, 1 minute to 72 h. */
function flightMinutes(input: unknown): number {
  const minutes = Number(input);
  if (
    !Number.isInteger(minutes) ||
    minutes < GIFT_MINUTES.min ||
    minutes > GIFT_MINUTES.max
  )
    fail('Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.');
  return minutes;
}

/** The gift fleet of one player: from and to their home planet, no fuel. */
function giftFleet(ctx: Ctx, home: Planet, dep: number, arr: number): Fleet {
  const at = { g: home.g, s: home.s, p: home.p };
  return {
    id: ctx.id(),
    owner: home.owner,
    from: home.id,
    fromC: at,
    to: home.id,
    toC: at,
    mission: 'deploy',
    ships: giftShips(),
    cargo: giftCargo(),
    dep,
    arr,
    ret: arr + (arr - dep),
    state: 'out',
    recalled: false,
    fuel: 0,
    gift: true,
  };
}

/**
 * Rings in the „Endzeit“: every player with a home planet at this moment
 * gets the start message and a gift fleet, suspended and admin accounts
 * included (D6/D7). The flight time runs in real time, not with the speed
 * of the universe, and is saved as the next default.
 */
export const endzeit: Action = (ctx, u, d, event) => {
  requireAdmin(u);
  const round = roundRules(ctx).number;
  if (ctx.admin.setting(ENDZEIT_ROUND) === round)
    fail('Die Endzeit wurde in dieser Runde schon eingeläutet.');
  const minutes = flightMinutes(d.minutes);
  const dep = ctx.now();
  const arr = dep + minutes * MINUTE;
  let recipients = 0;
  for (const player of ctx.players.all()) {
    const home = ctx.planets.home(player.id);
    if (!home) continue;
    ctx.fleets.save(giftFleet(ctx, home, dep, arr));
    addReport(ctx, player.id, {
      time: dep,
      type: 'info',
      title: 'Endzeit',
      text: START_TEXT,
    });
    recipients++;
  }
  ctx.admin.putSettings([
    [ENDZEIT_ROUND, round],
    [ENDZEIT_MINUTES, minutes],
  ]);
  if (event) event.detail = { round, minutes, recipients, due: arr };
  return `Die Endzeit ist eingeläutet. Gaben unterwegs: ${recipients}.`;
};

/**
 * The planet where a cancelled research is refunded: where it started, the
 * home planet for research of before #49 or a planet the player no longer has.
 */
function researchPlanet(
  ctx: Ctx,
  owner: string,
  home: Planet,
  id: string | undefined,
): Planet {
  const there = id && id !== home.id ? ctx.planets.get(id) : null;
  return there?.owner === owner ? there : home;
}

/**
 * Raises the research of the owner at the arrival. The other planets take
 * the research before into their production first, as a change of the
 * settings does; a running research the gift overtakes is refunded where
 * it started.
 */
function raiseResearch(
  ctx: Ctx,
  owner: User,
  home: Planet,
  at: number,
  need: Levels,
): void {
  for (const x of ctx.planets.ofOwner(owner.id))
    if (x.id !== home.id) ctx.planets.save(settle(x, at, universe(ctx), owner));
  const r = settleR(owner, at);
  r.research = raise(r.research, need);
  if (overtaken(r.rq, r.research)) {
    const payer = researchPlanet(ctx, owner.id, home, r.rq!.planet);
    refund(payer, r.rq!.cost);
    // The home planet is saved again with the gift.
    ctx.planets.save(payer);
    cancelScheduledPush(ctx, owner.id, 'research');
    r.rq = null;
  }
  owner.research = r.research;
  owner.rq = r.rq;
  ctx.players.save(owner);
}

/** Raises the buildings of the home planet; an overtaken build is refunded. */
function raiseBuildings(ctx: Ctx, t: Planet, need: Levels): void {
  t.b = raise(t.b, need);
  if (!overtaken(t.bq, t.b)) return;
  refund(t, t.bq!.cost);
  cancelScheduledPush(ctx, t.owner, 'buildings', `${t.id}:${t.bq!.start}`);
  t.bq = null;
}

/**
 * The gift arrives at the home planet `t` (settled to the arrival): ships
 * and cargo land, also above the storage, research and buildings are raised
 * (D2, D3, D4), and the player gets the arrival message with push.
 */
export function giftArrive(ctx: Ctx, f: Fleet, t: Planet): void {
  const need = giftLevels();
  land(t, f.ships, f.cargo);
  raiseBuildings(ctx, t, need.b);
  const owner = ctx.players.get(f.owner);
  if (owner) raiseResearch(ctx, owner, t, f.arr, need.r);
  ctx.planets.save(t);
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: ARRIVAL_TEXT,
    text: ARRIVAL_TEXT,
  });
  ctx.fleets.delete(f.id);
}
