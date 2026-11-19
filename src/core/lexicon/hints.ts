// The personal hints of „Deine nächsten Ziele“ (#289, D2 option 1): what
// follows from the player's own state by the rules of the game, never an
// opinion. Every hint is one rule: energy that is short, a store that is
// full, no free field, every fleet slot in use, the limit of planets reached,
// or a requirement that is one level away. A hint is a text with `{values}`
// and the links of its words, so no number is typed into it (#285, B8); the
// functions are pure and take the state the browser already holds, so no part
// of the server is needed.
import { BUILD, buildable, DEF, RES, SHIPS } from '../catalog.ts';
import { BASE_INCOME } from '../components/produces.ts';
import { colonyRules, limitReached, planetLimit } from '../colony-limit.ts';
import { caps, production } from '../economy.ts';
import { fieldsFull, maxFields } from '../fields.ts';
import { fleetSlots } from '../flight.ts';
import { unmetRequirements } from '../requirements.ts';
import type { Requirements } from '../types.ts';
import { number, percent } from './say.ts';
import type { LexState, Own } from './types.ts';

/** One hint: words with their values, and the rule it comes from. */
export interface Hint {
  /** The rule of the list below that gave it, and for a requirement the entry. */
  id: string;
  text: string;
  values: Readonly<Record<string, string>>;
}

/** What a hint is computed from: the state of a player with a shown planet. */
type Known = LexState & { own: Own };

const RESOURCES = [
  ['m', 'Adamant', 'smetal'],
  ['c', 'Psikristall', 'scrystal'],
  ['d', 'Promethium', 'sdeut'],
] as const;

/** The energy of the shown planet falls short: the mines run at a share of their power. */
function energy(s: Known): Hint[] {
  const p = production(s.own.planet, s.u, s.research);
  if (p.eUse <= 0 || p.f >= 1) return [];
  return [
    {
      id: 'energy',
      text: 'Dir fehlt Energie: Die Förderstätten dieses Planeten laufen nur mit {share} ihrer Leistung. Die [[solar|Sonnenkathedrale]], das [[fusion|Fusionssanktum]] und die [[sat|Sonnenreliquiare]] liefern Energie ([[rule-production]]).',
      values: { share: percent(p.f) },
    },
  ];
}

/** A store is full: its production stands still. */
function store(s: Known): Hint[] {
  const limit = caps(s.own.planet, s.u);
  const full = RESOURCES.filter(([key]) => s.own.planet.res[key] >= limit[key]);
  if (!full.length) return [];
  return [
    {
      id: 'store',
      text: 'Das Lager für {resources} ist voll, und die Förderung steht dort still. Baue {stores} aus oder gib Rohstoffe aus ([[rule-production]]).',
      values: {
        resources: full.map(([, label]) => label).join(', '),
        stores: full.map(([, , key]) => `[[${key}]]`).join(', '),
      },
    },
  ];
}

/** Every field is used: no building level can be added. */
function fields(s: Known): Hint[] {
  const { planet } = s.own;
  if (!fieldsFull(planet, s.u)) return [];
  return [
    {
      id: planet.kind === 'moon' ? 'fields-moon' : 'fields',
      text:
        planet.kind === 'moon'
          ? 'Auf diesem Mond sind alle Felder belegt (Felder: {fields}). Die [[moonbase|Mondzitadelle]] schafft weitere Felder ([[rule-moons]]).'
          : 'Auf diesem Planeten sind alle Felder belegt (Felder: {fields}), und keine weitere Gebäudestufe lässt sich bauen. Die [[terraformer|Weltenschmiede]] schafft Felder, oder gründe eine Kolonie ([[faq-colony]]).',
      values: { fields: number(maxFields(planet, s.u) ?? 0) },
    },
  ];
}

/** Every fleet slot is in use. */
function slots(s: Known): Hint[] {
  const all = fleetSlots({ research: s.research });
  if (s.own.fleets < all) return [];
  return [
    {
      id: 'slots',
      text: 'Alle Flottenslots sind belegt (Flottenslots: {slots}). Die [[computer|Kogitator-Doktrin]] bringt mit jeder Stufe einen weiteren ([[faq-slots]]).',
      values: { slots: number(all) },
    },
  ];
}

/** The limit of planets is reached, and the research that raises it, where the round has it. */
function limit(s: Known): Hint[] {
  const rules = colonyRules(s.u);
  const level = s.research.colonial ?? 0;
  const max = planetLimit(rules, level);
  if (max === null || !limitReached(max, { owned: s.own.planets, flying: 0 }))
    return [];
  const values = { planets: number(s.own.planets), limit: number(max) };
  const hints: Hint[] = [
    {
      id: 'limit',
      text: 'Du hast die Planetengrenze dieser Runde erreicht (Planeten: {planets} von {limit}). Eine neue Kolonie braucht einen freien Platz: Gib eine Kolonie auf ([[rule-colonies]]).',
      values,
    },
  ];
  const raises =
    rules.research && (rules.maxLevel === 0 || level < rules.maxLevel);
  if (raises)
    hints.push({
      id: 'limit-research',
      text: 'Die Forschung [[colonial|Kolonialverwaltung]] hebt die Planetengrenze an (deine Stufe: {level}, Planetengrenze: {limit}).',
      values: { level: number(level), limit: number(max) },
    });
  return hints;
}

/** The most entries that are one level away the hints name. */
const MOST_NEAR = 3;

/** An entry whose only missing requirement is one level away. */
function near(s: Known): Hint[] {
  const places = {
    here: s.own.planet,
    research: { research: s.research, rq: null },
    cfg: s.u,
  };
  const entries: [string, Requirements | undefined][] = [
    ...Object.entries({ ...BUILD, ...RES, ...SHIPS, ...DEF }).map(
      ([key, def]): [string, Requirements | undefined] => [key, def.req],
    ),
  ];
  const found = entries.flatMap(([key, req]) => {
    const needs = unmetRequirements(req, places);
    const need = needs[0];
    if (needs.length !== 1 || !need || need.level - need.have !== 1) return [];
    // A building the shown place cannot hold is no step for it (a moon building on a planet).
    const here = s.own.planet.kind;
    if (!buildable(key, here) && key in BUILD) return [];
    if (need.kind === 'b' && !buildable(need.key, here)) return [];
    return [
      {
        id: `near-${key}`,
        text: 'Dir fehlt noch eine Stufe, um [[{entry}]] zu bekommen: [[{need}]] steht auf Stufe {have} und müsste Stufe {level} haben.',
        values: {
          entry: key,
          need: need.key,
          have: number(need.have),
          level: number(need.level),
        },
      },
    ];
  });
  return found.slice(0, MOST_NEAR);
}

/** Without a mine only the base income comes in. */
function start(s: Known): Hint[] {
  const { planet } = s.own;
  if (
    planet.kind !== 'planet' ||
    (planet.b.metal ?? 0) ||
    (planet.b.crystal ?? 0)
  )
    return [];
  return [
    {
      id: 'start',
      text: 'Ohne Förderstätten kommt auf diesem Planeten nur die Grundmenge herein, {metal} Adamant und {crystal} Psikristall je Stunde. Die [[metal|Adamant-Tiefbohrung]] und der [[crystal|Psikristall-Steinbruch]] fördern mehr ([[rule-production]]).',
      values: {
        metal: number(BASE_INCOME.m * s.u.speed),
        crystal: number(BASE_INCOME.c * s.u.speed),
      },
    },
  ];
}

/** The rules in the order of the list: what stands still first, what is near last. */
const RULES: readonly ((s: Known) => Hint[])[] = [
  energy,
  store,
  fields,
  slots,
  limit,
  near,
  start,
];

/** The most hints the page shows: a few next steps, not a list of everything. */
export const MOST_HINTS = 6;

/** Whether the state holds what the hints are computed from. */
const known = (s: LexState): s is Known => s.own !== undefined;

/** The hints of a state, in the order of the rules, at most `MOST_HINTS`; none without the own state. */
export function hintsOf(s: LexState): Hint[] {
  if (!known(s)) return [];
  return RULES.flatMap((rule) => rule(s)).slice(0, MOST_HINTS);
}
