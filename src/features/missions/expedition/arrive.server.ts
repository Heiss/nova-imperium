// What an expedition meets at its position (#93, okf/features/expeditions.md;
// owner, 2026-11-16 and 2026-11-17). The fleet arrives when its stay ends;
// the event is drawn once (src/core/expedition.ts): nothing, a find of
// resources or of ships, a battle with pirates or aliens, the loss of the
// fleet, or an earlier or later return. The report is written to the owner,
// the audit gets an entry, and what is left flies home. The debris of a
// battle lies at the expedition position (Q5), where a Bergung can take it.
import { battle } from '../../../core/battle.ts';
import { debrisOf, isEmpty } from '../../../core/debris.ts';
import {
  type Event,
  type Raider,
  type Size,
  drawEvent,
  earlyReturn,
  lateReturn,
  raidFleet,
  raiderTech,
  resourceFind,
  stayOf,
} from '../../../core/expedition.ts';
import { expoPoints, shipFind } from '../../../core/expedition-ships.ts';
import { capacity, countUnits } from '../../../core/flight.ts';
import { settleR } from '../../../core/settle.ts';
import { text } from '../../../core/text.ts';
import type { Fleet, Levels, Resources } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import {
  type Ctx,
  addReport,
  coords,
  fmt,
} from '../../../server/game/context.ts';
import { turnBack } from '../../../server/game/missions.ts';
import { topPoints } from '../../../server/game/points.ts';

/** The words of the reports, [V] (okf/features/expeditions.md). */
export const WORDS = {
  nothing: 'Die Expedition hat nichts Besonderes gefunden und kehrt heim.',
  noRoom:
    'Die Expedition hat Rohstoffe gefunden, aber ihre Laderäume sind zu klein, um etwas davon mitzunehmen.',
  noShips:
    'Die Expedition hat nach Schiffen gesucht, aber keine gefunden, die sich der Flotte anschließen.',
  lost: 'Von der Expedition kam nur noch ein abgerissener Funkspruch. Die Flotte ist verloren.',
  late: 'Die Expedition hat sich verirrt und kehrt später als geplant zurück.',
  early:
    'Die Expedition hat einen kürzeren Weg gefunden und kehrt früher als geplant zurück.',
} as const;

/** „einen kleinen“, „einen großen“ or „einen sehr großen“ before a find. */
const SIZE: Readonly<Record<Size, string>> = {
  normal: 'einen kleinen',
  large: 'einen großen',
  huge: 'einen sehr großen',
};

/** The names of the resources of a find. */
const RESOURCE: Readonly<Record<keyof Resources, string>> = {
  m: 'Adamant',
  c: 'Psikristall',
  d: 'Promethium',
};

/** The attackers' names in the battle report. */
const RAIDER: Readonly<Record<Raider, string>> = {
  pirates: 'Piraten',
  aliens: 'Aliens',
};

/** The result of a battle from the fleet's side; the attackers are the raiders. */
const RESULT = {
  att: 'verloren',
  def: 'gewonnen',
  draw: 'unentschieden',
} as const;

/** What changes on the fleet when it flies home; null for a fleet that is gone. */
type Homeward = Partial<Fleet> | null;

const info = (ctx: Ctx, f: Fleet, subject: string, body: string): void =>
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Expedition ${coords(f.toC)} – ${subject}`,
      text: body,
    },
    { topic: 'fleet' },
  );

/** The ships as a list, „3 Frachtläufer, 1 Lastbarke“. */
const shipList = (ships: Levels): string =>
  Object.entries(ships)
    .map(([k, n]) => `${fmt(n)} ${text(k)?.n}`)
    .join(', ');

const addShips = (a: Levels, b: Levels): Levels => {
  const sum = { ...a };
  for (const [k, n] of Object.entries(b)) sum[k] = (sum[k] ?? 0) + n;
  return sum;
};

function findResources(ctx: Ctx, f: Fleet, size: Size): Homeward {
  const room = capacity(f.ships) - f.fuel / 2;
  const find = resourceFind(
    ctx.rng,
    size,
    expoPoints(f.ships),
    topPoints(ctx),
    room,
  );
  info(
    ctx,
    f,
    'Rohstofffund',
    find.amount
      ? `Die Expedition hat ${SIZE[size]} Rohstofffund gemacht: ${fmt(find.amount)} ${RESOURCE[find.res]} kommen mit der Flotte heim.`
      : WORDS.noRoom,
  );
  return { cargo: { ...f.cargo, [find.res]: f.cargo[find.res] + find.amount } };
}

function findShips(ctx: Ctx, f: Fleet, size: Size): Homeward {
  const found = shipFind(
    ctx.rng,
    size,
    f.ships,
    expoPoints(f.ships),
    topPoints(ctx),
  );
  info(
    ctx,
    f,
    'Schiffsfund',
    countUnits(found)
      ? `Die Expedition hat ${SIZE[size]} Schiffsfund gemacht, die Schiffe schließen sich der Flotte an: ${shipList(found)}.`
      : WORDS.noShips,
  );
  return { ships: addShips(f.ships, found) };
}

/** The weapons, shield and armour levels of a research. */
const tech = (r: Levels): Levels => ({
  weapons: r.weapons ?? 0,
  shield: r.shield ?? 0,
  armor: r.armor ?? 0,
});

/**
 * A battle with pirates or aliens: they attack, the fleet defends. Both
 * sides' destroyed ships leave a Trümmerfeld at the position (Q5, a
 * deliberate deviation from classic); the ships left fly home.
 */
function fightRaiders(
  ctx: Ctx,
  f: Fleet,
  raider: Raider,
  size: Size,
): Homeward {
  const own = tech(settleR(ctx.players.get(f.owner)!, f.arr).research);
  const foes = raidFleet(ctx.rng, raider, size, f.ships);
  const foeTech = raiderTech(raider, own);
  const res = battle(
    { units: foes, tech: foeTech },
    { units: f.ships, tech: own },
    ctx.rng,
  );
  const debris = debrisOf([
    { before: foes, after: res.att },
    { before: f.ships, after: res.def },
  ]);
  if (!isEmpty(debris)) ctx.debris.add(f.toC, debris);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'battle',
      title: `Kampfbericht ${coords(f.toC)} – ${RESULT[res.winner]}`,
      participants: [f.owner],
      name: 'Expeditionsposition',
      coords: f.toC,
      attName: RAIDER[raider],
      defName: ctx.players.get(f.owner)!.name,
      rounds: res.rounds,
      winner: res.winner,
      attBefore: foes,
      attAfter: res.att,
      defBefore: f.ships,
      defAfter: res.def,
      rebuilt: {},
      debris,
      attTech: foeTech,
      defTech: own,
    },
    { topic: 'fleet' },
  );
  return countUnits(res.def) ? { ships: res.def } : null;
}

/** A change of the return time: when the fleet is back changes, nothing else. */
function changeReturn(
  f: Fleet,
  early: boolean,
  size: Size,
): Pick<Fleet, 'ret'> {
  const when = early ? earlyReturn : lateReturn;
  return { ret: when(f.arr, f.ret - f.arr, stayOf(f), size) };
}

function resolve(ctx: Ctx, f: Fleet, event: Event): Homeward {
  switch (event.kind) {
    case 'nothing':
      info(ctx, f, 'nichts entdeckt', WORDS.nothing);
      return {};
    case 'resources':
      return findResources(ctx, f, event.size);
    case 'ships':
      return findShips(ctx, f, event.size);
    case 'pirates':
    case 'aliens':
      return fightRaiders(ctx, f, event.kind, event.size);
    case 'lost':
      info(ctx, f, 'Flotte verloren', WORDS.lost);
      return null;
    case 'early':
      info(ctx, f, 'Rückkehr früher', WORDS.early);
      return changeReturn(f, true, event.size);
    case 'late':
      info(ctx, f, 'Rückkehr später', WORDS.late);
      return changeReturn(f, false, event.size);
  }
}

/** Resolves the event of the expedition: its report, its audit entry and the flight home. */
export function expedition(ctx: Ctx, f: Fleet, event: Event): void {
  const home = resolve(ctx, f, event);
  record(ctx, {
    category: 'system',
    action: 'expedition',
    actor: f.owner,
    detail: { fleet: f.id, ...event },
  });
  if (home) turnBack(ctx, f, home);
  else ctx.fleets.delete(f.id);
}

export function onArrive(ctx: Ctx, f: Fleet): void {
  expedition(ctx, f, drawEvent(ctx.rng));
}
