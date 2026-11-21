// The cards of the overview on a phone (#189, D5; okf/features/interface.md):
// „Läuft“ (what builds, researches and orders on the shown place, with the
// time left and a bar), „Achtung“ (an attack on the way, too little energy)
// and „Bereit“ (a reward to claim, new messages, an empty build queue on
// another place). Pure, so the component
// OverviewCards.svelte only renders what this module computes. What counts as
// „Achtung“ and „Bereit“ is the proposal of the issue (all [V]).
import { production } from '../../core/economy.ts';
import { MISSION } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import type { Mission } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { coords, fmt } from './format.ts';
import { fleetEnd, nameOf, sortFleets, unread } from './game.ts';
import { rewardHint } from './menu-hints.ts';
import { type Countdown, activityRows, countdown } from './overview.ts';

/**
 * The missions that are an attack on the way: the Sturmangriff, the
 * Mondbruch and the missiles. A spy, a transport or a holding fleet is none.
 */
const HOSTILE: ReadonlySet<Mission> = new Set([
  'attack',
  'moonbreak',
  'missile',
]);

/** The most incoming attacks the card names; the rest is counted. */
export const MOST_ATTACKS = 3;

/** An order of the shown place that is working, with its bar. */
export interface RunningItem {
  /** „Gebäude“, „Forschung“ or „Schiffsschmiede“. */
  label: string;
  what: string;
  due: Countdown;
  /** The bar: the length of the order or of the unit and how much has passed. */
  max: number;
  value: number;
  /** The shipyard counts down to its next unit, „(nächste)“. */
  next: boolean;
}

/** The most places with an empty build queue the card names; the rest is counted. */
export const MOST_IDLE = 3;

/** A line of „Achtung“ or „Bereit“; a link opens the view that fixes it. */
export interface CardItem {
  text: string;
  /** The countdown of an attack. */
  due?: Countdown;
  link?: { view: string; label: string };
  /** A button that makes this place the shown one (data-act `selectPlanet`). */
  select?: { id: string; label: string };
}

export interface OverviewCards {
  running: RunningItem[];
  attention: CardItem[];
  ready: CardItem[];
}

/** When the order of a label started and ends; the unit of the shipyard counts alone. */
function span(v: V, label: string): { start: number; end: number } {
  const { P, R, now } = v;
  if (label === 'Gebäude') return P.bq!;
  if (label === 'Forschung') return R.rq!;
  const start = P.sqT ?? now;
  return { start, end: start + P.sq[0]!.unit };
}

/** „Läuft“: the activities of the overview, each with its bar. */
export function runningItems(v: V): RunningItem[] {
  return activityRows(v).map((row) => {
    const { start, end } = span(v, row.label);
    const max = Math.max(end - start, 1);
    return {
      ...row,
      max,
      value: Math.min(Math.max(v.now - start, 0), max),
    };
  });
}

/** „Achtung“: the hostile fleets on their way to the shown place, then too little energy. */
export function attentionItems(v: V): CardItem[] {
  const { s, P, R, now } = v;
  const incoming = sortFleets(
    s.fleets.filter(
      (f) => f.owner !== s.me.id && f.state === 'out' && HOSTILE.has(f.mission),
    ),
  );
  const items: CardItem[] = incoming.slice(0, MOST_ATTACKS).map((f) => ({
    text: `${MISSION[f.mission]} von ${nameOf(s.players, f.owner)} ${coords(f.fromC)}`,
    due: countdown(fleetEnd(f), now),
  }));
  if (incoming.length > MOST_ATTACKS)
    items.push({
      text: `und ${incoming.length - MOST_ATTACKS} weitere Flotten`,
      link: { view: 'fleet', label: 'Zur Flotte' },
    });
  const pr = production(P, s.cfg, R.research);
  const missing = Math.ceil(pr.eUse - pr.eProd);
  if (missing > 0)
    items.push({
      text: `Zu wenig Energie: es fehlen ${fmt(missing)}`,
      link: { view: 'buildings', label: 'Zu den Gebäuden' },
    });
  return items;
}

/**
 * „Bauschleife leer“ for the other own places the server named (`idle`),
 * worded from the galaxy; a place the galaxy does not list is left out. At
 * most `MOST_IDLE` lines, then „und N weitere“.
 */
function idleItems({ s }: V): CardItem[] {
  const places = (s.idle ?? []).flatMap((id) => {
    const p = s.galaxy.find((x) => x.id === id);
    return p ? [{ id, text: `${placeName(p)} ${coords(p)}` }] : [];
  });
  const items: CardItem[] = places.slice(0, MOST_IDLE).map((p) => ({
    text: `Bauschleife leer: ${p.text}`,
    select: { id: p.id, label: 'Wechseln' },
  }));
  if (places.length > MOST_IDLE)
    items.push({ text: `und ${places.length - MOST_IDLE} weitere` });
  return items;
}

/** „Bereit“: a reward to claim, new messages, an empty build queue elsewhere. */
export function readyItems(v: V): CardItem[] {
  const { s } = v;
  const items: CardItem[] = [];
  const reward = rewardHint(s);
  if (reward)
    items.push({
      text: reward,
      link: { view: 'achievements', label: 'Abholen' },
    });
  const fresh = unread(s.reports, s.me.readAt);
  if (fresh)
    items.push({
      text:
        fresh === 1
          ? '1 ungelesene Nachricht'
          : `${fresh} ungelesene Nachrichten`,
      link: { view: 'messages', label: 'Lesen' },
    });
  return [...items, ...idleItems(v)];
}

/** The three cards of the shown place. */
export const overviewCards = (v: V): OverviewCards => ({
  running: runningItems(v),
  attention: attentionItems(v),
  ready: readyItems(v),
});
