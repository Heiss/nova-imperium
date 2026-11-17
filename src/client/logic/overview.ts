// The overview (#118, okf/architecture/patterns.md, section 9): what the
// component Overview shows, without HTML: the fleet movements, the shown
// place and what is being built, researched or ordered. The fleet movements
// are also the list of the fleet view.
import { MISSION } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import { text } from '../../core/text.ts';
import type { V } from '../views/common.ts';
import { diameterLine } from './fields.ts';
import { coords, dt, dur, fmt, resLine } from './format.ts';
import { fleetEnd, nameOf, ranks, sortFleets } from './game.ts';
import { planetLook } from './planet.ts';
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
  /** `fl-<mission>` on its way out, `fl-back` on its way home. */
  cls: string;
  parts: TextPart[];
  /** An own fleet on its way out can be called back, the gift not (#161). */
  recall: boolean;
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
        `Deine Flotte (${ships}) von ${origin} erreicht ${coords(f.toC)} · ${mission}${cargoPart(f)}`,
      ),
    ];
  return [
    part(
      `Deine Flotte (${ships}) kehrt von ${coords(f.toC)} nach ${coords(f.fromC)} zurück${cargoPart(f)}`,
    ),
  ];
}

function fleetRow(v: V, f: ClientFleet): FleetRow {
  const out = f.state === 'out';
  return {
    id: f.id,
    due: countdown(fleetEnd(f), v.now),
    cls: out ? `fl-${f.mission}` : 'fl-back',
    parts: fleetParts(v, f),
    recall: f.owner === v.s.me.id && out && !f.gift,
  };
}

/** The fleets of the player, and on request the foreign ones coming, by when they are due. */
export const fleetRows = (v: V, includeIncoming: boolean): FleetRow[] =>
  sortFleets(
    v.s.fleets.filter((f) => f.owner === v.s.me.id || includeIncoming),
  ).map((f) => fleetRow(v, f));

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
    moon,
    label: moon ? 'Mond' : 'Planet',
    name,
    position: coords(P),
    type: moon ? 'Mond' : planetLook(P).name,
    temperature: `ca. ${P.temp - 40}°C bis ${P.temp}°C`,
    diameter: diameterLine(P, s.cfg),
    points: `${fmt(s.players[me]?.points)} (Platz ${ranks(s.players)[me] ?? '-'} von ${Object.keys(s.players).length})`,
    time: dt(v.now),
    activities: activityRows(v),
  };
}
