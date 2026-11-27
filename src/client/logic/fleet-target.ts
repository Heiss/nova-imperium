// The fleet form beside the target (out of main.ts, ratchet #242): what the
// target position is, the expedition position and the stay of an expedition
// (#93). The form itself is the component Fleet (logic/fleet.ts).
import {
  expeditionPosition,
  isExpeditionPlace,
} from '../../core/expedition.ts';
import { type FitTarget, missionsFor } from '../../core/mission-fit.ts';
import { MISSION, missionRules } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import { placeId } from '../../core/place.ts';
import type { Mission } from '../../core/types.ts';
import { debrisAt, debrisTip } from './debris.ts';
import { coords, esc } from './format.ts';
import { nameOf, type FleetForm } from './game.ts';
import { moonAt, moonTarget, ownPlaces } from './moon.ts';
import type { GalaxyPlanet, GameState } from './types.ts';

/**
 * Beside the target: its planet and owner, a free position, the expedition
 * position, or none; for a Bergung the Trümmerfeld there, or none (#45).
 */
export function targetInfo(s: GameState, f: FleetForm): string {
  const kind = missionRules(f.mission)?.target;
  if (kind === 'debris') {
    const field = debrisAt(s.debris, f.to);
    return field
      ? debrisTip(field)
      : '<span class="bad">kein Trümmerfeld</span>';
  }
  if (f.to.kind === 'moon')
    return moonTarget(moonAt(s.galaxy, f.to), (id) => nameOf(s.players, id));
  const target = s.galaxy.find(
    (p) => p.id === placeId({ ...f.to, kind: 'planet' }),
  );
  if (target)
    return `${esc(target.name)} (${esc(nameOf(s.players, target.owner))})`;
  // The position after the last planet position (#93).
  if (isExpeditionPlace(f.to, s.cfg))
    return kind === 'expedition'
      ? 'Expeditionsposition'
      : '<span class="bad">nur für Expeditionen</span>';
  return kind === 'free'
    ? 'Freie Position'
    : '<span class="bad">kein Planet</span>';
}

/** The highest position the target field takes: the expedition position (#93). */
export const maxPosition = (s: Pick<GameState, 'cfg'>): number =>
  expeditionPosition(s.cfg);

/**
 * What the browser knows of the place a fleet flies to (#253): the planet or
 * moon there, a Trümmerfeld, a lock after an abandonment, the expedition
 * position. The same facts the server reads when it checks a send.
 */
export function fitTarget(
  s: GameState,
  to: FleetForm['to'],
  now: number,
): FitTarget {
  const moon = to.kind === 'moon';
  const id = placeId({
    g: to.g,
    s: to.s,
    p: to.p,
    kind: moon ? 'moon' : 'planet',
  });
  const place = s.galaxy.find((p) => p.id === id);
  return {
    planet: place ? { id: place.id, owner: place.owner } : null,
    debris: !!debrisAt(s.debris, to),
    moon,
    locked: !!s.locks?.some(
      (l) => l.g === to.g && l.s === to.s && l.p === to.p && l.until > now,
    ),
    expedition: isExpeditionPlace(to, s.cfg),
    // „Wache stellen“ off hides the mission (#440).
    round: s.round,
  };
}

/**
 * The missions of the fleet form that fit the target, in the order of the
 * form (#253): the same check as the server, apart from what the browser
 * cannot know (the noob protection and the vacation of another player, who
 * is an ally), which stays offered and is refused by the server.
 */
export const offeredMissions = (
  s: GameState,
  from: string,
  to: FleetForm['to'],
  now: number,
  owner: string = s.me.id,
): Mission[] => missionsFor({ owner, from }, fitTarget(s, to, now));

/** The text of the list while no mission fits the target [V]. */
export const NO_MISSION = 'Kein Auftrag passt zum Ziel';

/** One option of the list „Auftrag“. */
export interface MissionOption {
  value: string;
  label: string;
  selected: boolean;
  disabled: boolean;
}

/**
 * The options of the list „Auftrag“: the missions that fit, the chosen one
 * selected while it still fits, else the first (#253); one disabled entry
 * with the words `NO_MISSION` when none fits. `selected` is the mission the
 * list ends on, or the empty string.
 */
export function missionChoices(
  offered: readonly Mission[],
  chosen: string | null | undefined,
): { options: MissionOption[]; selected: string } {
  if (!offered.length)
    return {
      options: [
        { value: '', label: NO_MISSION, selected: true, disabled: true },
      ],
      selected: '',
    };
  const selected = offered.find((m) => m === chosen) ?? offered[0]!;
  return {
    options: offered.map((m) => ({
      value: m,
      label: MISSION[m],
      selected: m === selected,
      disabled: false,
    })),
    selected,
  };
}

/**
 * The same options as HTML, as the fleet view wrote them before the
 * component (#118, bundle 3): the frozen reference test of the view
 * (src/test/fleet-reference.test.ts) compares the component with it.
 */
export function missionOptions(
  offered: readonly Mission[],
  chosen: string | null | undefined,
): { html: string; selected: string } {
  const { options, selected } = missionChoices(offered, chosen);
  if (!offered.length)
    return {
      html: `<option value="" selected disabled>${NO_MISSION}</option>`,
      selected,
    };
  return {
    html: options
      .map(
        (o) =>
          `<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`,
      )
      .join(''),
    selected,
  };
}

/** One entry of the list „Schnellwahl“: the place it enters as the target, and its words. */
export interface QuickTarget {
  /** The id of the planet or moon whose coordinates it enters. */
  id: string;
  label: string;
}

/** The first entry of the list „Schnellwahl“ (owner, 2026-11-17), which enters nothing. */
export const QUICK_FIRST = '– wählen –';

/** „Name [g:s:p]“, a moon with „(Mond)“ as on the Sternenkarte. */
const quickLabel = (
  p: Parameters<typeof placeName>[0] & {
    g: number;
    s: number;
    p: number;
  },
): string => `${placeName(p)} ${coords(p)}`;

/**
 * The own planets and moons other than the one the form starts from, by
 * position, the planet before its moon (owner, 2026-11-17, #253).
 */
export const ownQuickTargets = (s: GameState, from: string): QuickTarget[] =>
  ownPlaces(s.galaxy, s.me.id)
    .filter((p) => p.id !== from)
    .map((p) => ({ id: p.id, label: quickLabel(p) }));

/**
 * The entries of friends, guild members and last targets (#292), each from
 * the id of a place the server names: „Freund: Spieler [g:s:p]“, „Gilde:
 * Spieler [g:s:p]“ (the main planet of the player) and „Ziel: Spieler –
 * Planet [g:s:p]“. A place the galaxy does not list is left out; a place
 * already listed is left out too (`quickTargets`, #362).
 */
function placesOf(
  s: GameState,
  ids: readonly string[] | undefined,
  label: (player: string, p: GalaxyPlanet) => string,
): QuickTarget[] {
  return (ids ?? []).flatMap((id) => {
    const p = s.galaxy.find((x) => x.id === id);
    return p ? [{ id, label: label(nameOf(s.players, p.owner), p) }] : [];
  });
}

/**
 * The whole list „Schnellwahl“ in one flat list without groups (owner,
 * 2026-11-17, #292): the own places, the friends, the guild members, the
 * last targets; the own ones without a prefix, as in #253.
 */
export function quickTargets(s: GameState, from: string): QuickTarget[] {
  const { friends, guild, last } = s.quick ?? {};
  const all = [
    ...ownQuickTargets(s, from),
    ...placesOf(s, friends, (name, p) => `Freund: ${name} ${coords(p)}`),
    ...placesOf(s, guild, (name, p) => `Gilde: ${name} ${coords(p)}`),
    ...placesOf(
      s,
      last,
      (name, p) => `Ziel: ${name} – ${placeName(p)} ${coords(p)}`,
    ),
  ];
  // A place stands once, under the first group that has it (#362): the list
  // is keyed by the id of the place, whatever the server sends.
  const seen = new Set<string>();
  return all.filter((q) => !seen.has(q.id) && !!seen.add(q.id));
}
