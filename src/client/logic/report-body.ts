// The bodies of the reports of battles, espionage and surveys as the rows
// and values their components show (#330; first moved from views/messages.ts
// as HTML strings, #118, bundle 4). Nothing here is markup: the components
// BattleReport, SpyReport and SurveyReport render these values as text.
import { BUILD, DEF, RES, SHIPS, UNIT } from '../../core/catalog.ts';
import { countUnits } from '../../core/flight.ts';
import { text } from '../../core/text.ts';
import type { Coords, Levels, Resources } from '../../core/types.ts';
import type { Debris } from '../../core/debris.ts';
import type { PlanetActivity } from '../../core/activity.ts';
import { spyActivityText } from './activity.ts';
import { debrisLine } from './debris.ts';
import { moonLines } from './moon.ts';
import { moonbreakLines } from './moonbreak.ts';
import { coords, fmt, resLine, techLine } from './format.ts';
import { surveyReport, type SurveyBody } from './survey.ts';
import type { Report } from './types.ts';

/** One unit of a side: its name, the numbers before and after, and the loss. */
export interface UnitRow {
  name: string;
  before: string;
  after: string;
  lost: string;
  /** Units were lost: the cell is marked. */
  bad: boolean;
}

/** A side of a battle: a block with its title, tech, units and what follows them. */
export interface BattleSide {
  /** The class of the title: `fl-attack` for an attacker, `good` for a defender. */
  cls: 'fl-attack' | 'good';
  title: string;
  tech: string;
  /** No row: the side had no units. */
  units: UnitRow[];
  /** The rebuilt defense of the defender, when any. */
  rebuilt: string | null;
  /** The loot of an attacker of the union, when it took any. */
  share: string | null;
}

export interface BattleBody {
  kind: 'battle';
  head: string;
  /** The attackers, then the defender, then each fleet that held. */
  sides: BattleSide[];
  winner: string;
  loot: string | null;
  /** The debris, moon and Mondbruch lines after the winner. */
  lines: string[];
}

/** A part of an espionage report: a title and its lists; null is „keine“. */
interface SpySection {
  title: string;
  entries: { label: string | null; list: string | null }[];
}

export interface SpyBody {
  kind: 'spy';
  head: string;
  res: string;
  sections: SpySection[];
  counter: string;
  lost: boolean;
  hint: boolean;
}

export type ReportBody = BattleBody | SpyBody | SurveyBody;

/** A stored value as text; nothing for a field an older report lacks. */
const str = (x: unknown): string => String(x ?? '');

const name = (k: string): string => text(k)?.n ?? k;

function unitRows(before: Levels, after: Levels, keys: string[]): UnitRow[] {
  return keys
    .filter((k) => (before[k] ?? 0) > 0)
    .map((k) => {
      const b = before[k]!;
      const a = after[k] ?? 0;
      return {
        name: name(k),
        before: fmt(b),
        after: fmt(a),
        lost: fmt(b - a),
        bad: b - a > 0,
      };
    });
}

const WINNER: Record<string, string> = {
  att: 'Der Angreifer hat die Schlacht gewonnen!',
  def: 'Der Verteidiger hat die Schlacht gewonnen!',
  draw: 'Die Schlacht endet unentschieden.',
};

const lv = (x: unknown): Levels => (x as Levels | undefined) ?? {};

/** A fleet that held at the planet and defended it (#55). */
interface HeldSide {
  name: string;
  before: Levels;
  after: Levels;
  tech: Levels;
}

/** A further fleet of an attack union that fought along (#225), with its share of the loot. */
interface JoinedSide extends HeldSide {
  loot?: Resources;
}

/** The loot as a line, when it took anything. */
const lootLine = (loot: Resources | undefined): string | null =>
  loot && loot.m + loot.c + loot.d ? resLine(loot) : null;

const side = (
  cls: BattleSide['cls'],
  title: string,
  tech: unknown,
  before: unknown,
  after: unknown,
  keys: string[],
  extra: Partial<Pick<BattleSide, 'rebuilt' | 'share'>> = {},
): BattleSide => ({
  cls,
  title,
  tech: techLine(lv(tech)),
  units: unitRows(lv(before), lv(after), keys),
  rebuilt: null,
  share: null,
  ...extra,
});

/** The block of the first attacker, then one of each further attacker of the union (#225). */
function attackerSides(r: Report): BattleSide[] {
  const attacker = (
    who: unknown,
    tech: unknown,
    before: unknown,
    after: unknown,
    loot?: Resources,
  ): BattleSide =>
    side(
      'fl-attack',
      `Angreifer ${str(who)}`,
      tech,
      before,
      after,
      Object.keys(SHIPS),
      { share: lootLine(loot) },
    );
  const joined = (r.attackers as JoinedSide[] | undefined) ?? [];
  return [
    attacker(
      r.attName,
      r.attTech,
      r.attBefore,
      r.attAfter,
      r.attLoot as Resources | undefined,
    ),
    ...joined.map((j) => attacker(j.name, j.tech, j.before, j.after, j.loot)),
  ];
}

/** The defense the defender got back, „n Name, …“, or nothing. */
function rebuiltLine(rebuilt: Levels): string | null {
  return countUnits(rebuilt)
    ? Object.entries(rebuilt)
        .map(([k, n]) => `${fmt(n)} ${name(k)}`)
        .join(', ')
    : null;
}

function battleBody(r: Report): BattleBody {
  const defender = side(
    'good',
    `Verteidiger ${str(r.defName)}`,
    r.defTech,
    r.defBefore,
    r.defAfter,
    Object.keys(UNIT),
    { rebuilt: rebuiltLine(lv(r.rebuilt)) },
  );
  // Each fleet that held fights as a defender of its own (#55).
  const held = ((r.held as HeldSide[] | undefined) ?? []).map((h) =>
    side(
      'good',
      `Verteidiger ${str(h.name)}`,
      h.tech,
      h.before,
      h.after,
      Object.keys(SHIPS),
    ),
  );
  return {
    kind: 'battle',
    head: `Schlacht bei ${str(r.name)} ${coords(r.coords as Coords)} · ${str(r.rounds)} Runde(n)`,
    sides: [...attackerSides(r), defender, ...held],
    winner: WINNER[String(r.winner)] ?? '',
    loot: lootLine(r.loot as Resources | undefined),
    lines: [
      debrisLine(r.debris as Debris | undefined),
      ...moonLines(r),
      ...moonbreakLines(r),
    ].filter(Boolean),
  };
}

/** The ships of a section, „Name: n · …“, or none. */
const unitList = (o: Levels, keys: string[]): string =>
  keys
    .filter((k) => (o[k] ?? 0) > 0)
    .map((k) => `${name(k)}: ${fmt(o[k])}`)
    .join(' · ');

/** A part the spy saw, or none for one the report does not hold. */
function section(title: string, o: unknown, keys: string[]): SpySection | null {
  if (!o) return null;
  return {
    title,
    entries: [{ label: null, list: unitList(lv(o), keys) || null }],
  };
}

/** The activity of the target, in reports since #175. */
function spyActivity(r: Report): SpySection | null {
  const words = spyActivityText(
    r.activity as PlanetActivity | null | undefined,
  );
  return words === null
    ? null
    : { title: 'Aktivität', entries: [{ label: null, list: words }] };
}

/**
 * The fleets that hold at the planet, apart from its fleet, when the spy's
 * Auspex-Lehre reaches the round's level (#55, owner, 2026-11-17).
 */
function heldSection(r: Report): SpySection | null {
  const held = r.held as { name: string; ships: Levels }[] | undefined;
  if (!held?.length) return null;
  return {
    title: 'Gehaltene Flotten',
    entries: held.map((h) => ({
      label: str(h.name),
      list: unitList(lv(h.ships), Object.keys(SHIPS)) || null,
    })),
  };
}

function spyBody(r: Report): SpyBody {
  return {
    kind: 'spy',
    head: `Rohstoffe auf ${str(r.name)} ${coords(r.coords as Coords)} (Spieler ${str(r.defName)}):`,
    res: resLine(r.res as Resources),
    sections: [
      spyActivity(r),
      section('Flotte', r.ships, Object.keys(SHIPS)),
      heldSection(r),
      section('Verteidigung', r.def, Object.keys(DEF)),
      section('Gebäude', r.b, Object.keys(BUILD)),
      section('Forschung', r.r, Object.keys(RES)),
    ].filter((x) => x !== null),
    counter: str(r.counter),
    lost: !!r.lost,
    hint: !r.ships && !r.lost,
  };
}

/**
 * The values of the body of a battle, espionage or survey report, or null
 * for a report that is only text. The list of reports (logic/messages.ts,
 * Messages.svelte) renders them with ReportBody.svelte.
 */
export function reportBody(r: Report): ReportBody | null {
  if (r.type === 'battle') return battleBody(r);
  if (r.type === 'spy') return spyBody(r);
  if (r.type === 'survey') return surveyReport(r);
  return null;
}
