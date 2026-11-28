// The overview (#118, okf/architecture/patterns.md, section 9): what the
// component Overview shows, without HTML: the fleet movements, the shown
// place and what is being built, researched or ordered. The fleet movements
// are also the list of the fleet view.
import { highscoreShows, SHOWS } from '../../core/highscore-categories.ts';
import { isFleet, MISSION, missionRules } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import { text } from '../../core/text.ts';
import type { V } from '../views/common.ts';
import { planetsLine } from './colony-limit.ts';
import { abandonOffered } from './abandon.ts';
import { diameterLine } from './fields.ts';
import { coords, dt, dur, fmt, resLine } from './format.ts';
import { fleetEnd, nameOf, ranks, sortFleets } from './game.ts';
import { planetLook } from './planet.ts';
import { unionPart } from './union.ts';
import type { ClientFleet } from './types.ts';

/** A countdown to `end`; `left` is null when it is due. The clock counts it down. */
export interface Countdown {
  end: number;
  left: string | null;
}

export const countdown = (end: number, now: number): Countdown => ({
  end,
  left: end > now ? dur(end - now) : null,
});

/** A piece of a line; the owner of a foreign fleet is bold. */
interface TextPart {
  text: string;
  bold: boolean;
}

/** One fleet movement. */
export interface FleetRow {
  id: string;
  /** When it arrives, or when it is back home. */
  due: Countdown;
  /** `fl-<mission>` on its way out or holding, `fl-back` on its way home. */
  cls: string;
  parts: TextPart[];
  /**
   * An own fleet on its way out or holding (#55) can be called back, the
   * gift (#161) and missiles (#54) not.
   */
  recall: boolean;
}

/** A foreign fleet that holds at the shown planet (#55), or flies there to hold (#440): its owner, ships and end. */
export interface HeldRow {
  id: string;
  /** When it flies home; on its way, when it arrives. */
  due: Countdown;
  parts: TextPart[];
}

/** A queue of the shown planet that is working. */
interface ActivityRow {
  label: string;
  what: string;
  due: Countdown;
  /** The shipyard counts down to its next unit, „(nächste)“. */
  next: boolean;
}

export interface OverviewPage {
  title: string;
  fleets: FleetRow[];
  /** „Gehaltene Flotten“: the foreign fleets that hold at the planet (#55). */
  held: HeldRow[];
  /** A moon shows its picture, a planet its layers (#53). */
  moon: boolean;
  /** „Planet“ or „Mond“. */
  label: string;
  name: string;
  position: string;
  /** The planet type, or „Mond“. */
  type: string;
  temperature: string;
  diameter: string;
  /** The points with the place in the highscore. */
  points: string;
  /** The time of the server at the render. */
  time: string;
  activities: ActivityRow[];
  /** Whether „Kolonie aufgeben“ is offered (#224): not on a moon or the main planet. */
  abandon: boolean;
  /** The planets against the limit of the round (#237). */
  planets: string;
}

const part = (text: string, bold = false): TextPart => ({ text, bold });

const shipList = (f: ClientFleet): string =>
  Object.entries(f.ships ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${fmt(n)} ${text(k)?.n ?? k}`)
    .join(', ');

/** What an own fleet carries, „ · Ladung: …“; nothing when it carries nothing (#259). */
const cargoPart = (f: ClientFleet): string =>
  f.cargo && (f.cargo.m || f.cargo.c || f.cargo.d)
    ? ` · Ladung: ${resLine(f.cargo)}`
    : '';

/**
 * What the Auspex-Lehre recognizes of a foreign fleet (#228): the exact
 * ships, else the total and the types the server sent, else
 * „Zusammensetzung unbekannt“.
 */
function foreignShips(f: ClientFleet): string {
  if (f.ships) return shipList(f);
  const seen = [
    f.total === undefined ? '' : `Schiffe insgesamt: ${fmt(f.total)}`,
    (f.types ?? []).map((k) => text(k)?.n ?? k).join(', '),
  ].filter(Boolean);
  return seen.length ? seen.join(' · ') : 'Zusammensetzung unbekannt';
}

function fleetParts(v: V, f: ClientFleet): TextPart[] {
  const mission = MISSION[f.mission];
  if (f.owner !== v.s.me.id) {
    const ships = foreignShips(f);
    return [
      part('Eine fremde Flotte von '),
      part(nameOf(v.s.players, f.owner), true),
      part(
        ` ${coords(f.fromC)} erreicht deinen Planeten ${coords(f.toC)} · ${mission}${ships ? ` (${ships})` : ''}`,
      ),
    ];
  }
  const ships = shipList(f);
  // The gift of the „Endzeit“ comes from „Gottkaiser“ (#161).
  const origin = f.gift ? 'Gottkaiser' : coords(f.fromC);
  if (f.state === 'out')
    return [
      part(
        `Deine Flotte (${ships}) von ${origin} erreicht ${coords(f.toC)} · ${mission}${unionPart(f)}${cargoPart(f)}`,
      ),
    ];
  if (f.state === 'hold')
    return [
      part(
        `Deine Flotte (${ships}) hält bei ${coords(f.toC)} · ${mission}${cargoPart(f)}`,
      ),
    ];
  return [
    part(
      `Deine Flotte (${ships}) kehrt von ${coords(f.toC)} nach ${coords(f.fromC)} zurück${cargoPart(f)}`,
    ),
  ];
}

function fleetRow(v: V, f: ClientFleet): FleetRow {
  const back = f.state === 'back';
  return {
    id: f.id,
    due: countdown(fleetEnd(f), v.now),
    cls: back ? 'fl-back' : `fl-${f.mission}`,
    parts: fleetParts(v, f),
    recall: f.owner === v.s.me.id && !back && isFleet(f),
  };
}

const own = (v: V, f: ClientFleet): boolean => f.owner === v.s.me.id;

/**
 * A foreign fleet that holds at the planet, or flies there to hold: shown
 * under „Gehaltene Flotten“ (#55), where the host can send it away (#440,
 * 230b), and not among the movements.
 */
const heldHere = (v: V, f: ClientFleet): boolean =>
  !own(v, f) &&
  (f.state === 'hold' ||
    (f.state === 'out' && missionRules(f.mission)?.holds === true));

/**
 * The fleets of the player, and on request the foreign ones coming, by when
 * they are due; foreign fleets that hold are no movement (#55).
 */
export const fleetRows = (v: V, includeIncoming: boolean): FleetRow[] =>
  sortFleets(
    v.s.fleets.filter((f) => own(v, f) || (includeIncoming && !heldHere(v, f))),
  ).map((f) => fleetRow(v, f));

/** The foreign fleets that hold at the shown planet, by when they fly home (#55). */
export const heldRows = (v: V): HeldRow[] =>
  sortFleets(v.s.fleets.filter((f) => heldHere(v, f))).map((f) => ({
    id: f.id,
    due: countdown(fleetEnd(f), v.now),
    // On its way it reads as an incoming fleet (#440).
    parts:
      f.state === 'out'
        ? fleetParts(v, f)
        : [
            part('Flotte von '),
            part(nameOf(v.s.players, f.owner), true),
            part(` ${coords(f.fromC)} (${foreignShips(f)})`),
          ],
  }));

/** What the shown planet builds, researches and orders. */
export function activityRows(v: V): ActivityRow[] {
  const { P, R, now } = v;
  const rows: ActivityRow[] = [];
  if (P.bq)
    rows.push({
      label: 'Gebäude',
      what: `${text(P.bq.key)?.n} (Stufe ${P.bq.lvl})`,
      due: countdown(P.bq.end, now),
      next: false,
    });
  if (R.rq)
    rows.push({
      label: 'Forschung',
      what: `${text(R.rq.key)?.n} (Stufe ${R.rq.lvl})`,
      due: countdown(R.rq.end, now),
      next: false,
    });
  if (P.sq.length)
    rows.push({
      label: 'Schiffsschmiede',
      what: P.sq.map((q) => `${fmt(q.n)}× ${text(q.key)?.n}`).join(', '),
      due: countdown((P.sqT ?? now) + P.sq[0]!.unit, now),
      next: true,
    });
  return rows;
}

/** The overview of the shown planet or moon. */
export function overviewPage(v: V): OverviewPage {
  const { P, s } = v;
  const me = s.me.id;
  const moon = P.kind === 'moon';
  const name = placeName(P);
  return {
    title: `Übersicht – ${name} ${coords(P)}`,
    fleets: fleetRows(v, true),
    held: heldRows(v),
    moon,
    label: moon ? 'Mond' : 'Planet',
    name,
    position: coords(P),
    type: moon ? 'Mond' : planetLook(P).name,
    temperature: `ca. ${P.temp - 40}°C bis ${P.temp}°C`,
    diameter: diameterLine(P, s.cfg),
    // The own points without a place while the highscore shows nothing (182a).
    points:
      highscoreShows(s.round) === SHOWS.none
        ? fmt(s.players[me]?.points)
        : `${fmt(s.players[me]?.points)} (Platz ${ranks(s.players)[me] ?? '-'} von ${Object.keys(s.players).length})`,
    time: dt(v.now),
    activities: activityRows(v),
    abandon: abandonOffered(P, s),
    planets: planetsLine(s),
  };
}
