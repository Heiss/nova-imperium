// The HTML builders of the pieces that #337 turned into Svelte components,
// frozen as they were before: the cost line (`costHTML`), the list of unmet
// requirements (`requirementsHTML`), the layered planet (`planetHTML`), the
// picture and the symbol of a moon, the symbol of a Trümmerfeld and the
// button „Bergung“. The reference tests (galaxy-reference.test.ts,
// overview-reference.test.ts, catalog-list-reference.test.ts,
// html-pieces-reference.test.ts and the copy catalog-reference/Buildings.svelte)
// compare the components with them. The code is that of
// src/client/views/common.ts, src/client/logic/moon.ts and
// src/client/logic/debris.ts as they were; never edit it to make a test pass.
import type { Debris } from '../core/debris.ts';
import { production } from '../core/economy.ts';
import { MISSION } from '../core/missions.ts';
import { placeName } from '../core/moon.ts';
import {
  type Need,
  type NeedState,
  needState,
  type Places,
  unmetRequirements,
} from '../core/requirements.ts';
import type { Coords, Cost, Planet, Requirements } from '../core/types.ts';
import { esc, fmt } from '../client/logic/format.ts';
import { type ResourceKey, resourceIconURL } from '../client/logic/icons.ts';
import { planetLook } from '../client/logic/planet.ts';
import type { GalaxyPlanet } from '../client/logic/types.ts';
import type { V } from '../client/views/common.ts';

const COST_NAMES = ['Adamant', 'Psikristall', 'Promethium'] as const;
const COST_ICONS: ResourceKey[] = ['metal', 'crystal', 'deuterium'];
const HAVE = ['m', 'c', 'd'] as const;

/** A small resource icon whose alt text names the resource. */
const resIcon = (key: ResourceKey, name: string): string =>
  `<img class="ri" src="${resourceIconURL(key)}" alt="${name}" width="20" height="20">`;

const costPart = (icon: string, v: number, have: number): string =>
  `<span>${icon}<b class="${have >= v ? '' : 'bad'}">${fmt(v)}</b></span>`;

/**
 * The cost in resources; `energy` is an energy production the planet must
 * have (Gravitonforschung, #49), `production` what it has.
 */
export function costHTML(
  c: Cost,
  p: Planet,
  n = 1,
  energy?: { need: number; production: number },
): string {
  const parts = COST_NAMES.map((name, i) => ({
    icon: resIcon(COST_ICONS[i]!, name),
    v: c[i]! * n,
    have: p.res[HAVE[i]!],
  }))
    .filter((x) => x.v > 0)
    .map((x) => costPart(x.icon, x.v, x.have));
  if (energy?.need)
    parts.push(
      costPart(
        resIcon('energy', 'Energieproduktion'),
        energy.need,
        energy.production,
      ),
    );
  return `<div class="cost">${parts.join('')}</div>`;
}

/** The line below a requirement: why it waits, or what its next level costs. */
function whyLine(v: V, n: Need, st: NeedState): string {
  if (!st.ready) return st.reason!;
  if (st.busy) return st.busy;
  const energy = st.energy
    ? {
        need: st.energy,
        production: production(v.P, v.s.cfg, v.R.research).eProd,
      }
    : undefined;
  return `Stufe ${n.have + 1}: ${costHTML(st.cost, v.P, 1, energy)}`;
}

/** „Jetzt bauen“ / „Jetzt forschen“ for a requirement that can start now. */
function startButton(n: Need, st: NeedState): string {
  if (!st.ready) return '';
  const build = n.kind === 'b';
  return `<button class="small go" data-act="${build ? 'build' : 'research'}" data-k="${n.key}"${st.busy ? ' disabled' : ''}>${build ? 'Jetzt bauen' : 'Jetzt forschen'}</button>`;
}

function needItem(v: V, n: Need, pl: Places): string {
  const st = needState(n, pl);
  const via = n.via ? ` <span class="via">· für ${esc(n.via)}</span>` : '';
  return `<li class="need ${st.ready ? 'ready' : 'missing'}"><div><b class="need-nm">${esc(n.name)}</b> – Stufe ${n.level} (aktuell ${n.have})${via}<div class="why">${whyLine(v, n, st)}</div></div>${startButton(n, st)}</li>`;
}

/**
 * All unmet requirements of an entry, indirect ones included (issue #64).
 * Everything is built and researched on the shown planet (issue #49).
 */
export function requirementsHTML(v: V, req: Requirements | undefined): string {
  const pl: Places = { here: v.P, research: v.R, cfg: v.s.cfg };
  const list = unmetRequirements(req, pl);
  if (!list.length) return '';
  return `<div class="needs"><div class="needs-h">Benötigt:</div><ul>${list.map((n) => needItem(v, n, pl)).join('')}</ul></div>`;
}

/**
 * A layered planet (issue #61, D7): the surface turns, the clouds drift, the
 * atmosphere breathes. main.ts sets the textures from data-surface and
 * data-clouds (no inline styles under the CSP). `still` is for small planets.
 */
export function planetHTML(c: Coords, still = false): string {
  const look = planetLook(c);
  return `<div class="pl pl-${look.type}${still ? ' pl-still' : ''}" role="img" aria-label="${look.name}" data-surface="${look.surface}" data-clouds="${look.clouds}"><div class="pl-body"><div class="pl-surface"></div><div class="pl-clouds"></div><div class="pl-shade"></div></div></div>`;
}

/** The picture of a moon, also the symbol on the Sternenkarte. */
export const moonPicture = (name: string, size: number): string =>
  `<img class="moon" src="/icons/moon.svg" alt="${esc(name)}" width="${size}" height="${size}">`;

/** The symbol at the planet: a button that opens or closes the moon's actions. */
export const moonMark = (moon: GalaxyPlanet, open: boolean): string =>
  `<button type="button" id="${esc(`moon-${moon.id}`)}" class="moon-btn" data-act="gmoon" data-id="${esc(moon.id)}" aria-expanded="${open}" title="${esc(placeName(moon))}">${moonPicture(placeName(moon), 20)}</button>`;

/** The tooltip of the symbol of a Trümmerfeld. */
const debrisTip = (d: Debris): string =>
  `Trümmerfeld: ${fmt(d.m)} Adamant, ${fmt(d.c)} Psikristall`;

/** The symbol of a field on the Sternenkarte, with its tooltip. */
export const debrisMark = (d: Debris): string => {
  const tip = debrisTip(d);
  return `<img class="debris" src="/icons/debris.svg" alt="${tip}" title="${tip}" width="20" height="20">`;
};

/** The button that opens the fleet form with the mission „Bergung“. */
export const harvestButton = (c: Coords): string =>
  `<button class="small" data-act="gfleet" data-m="harvest" data-g="${c.g}" data-s="${c.s}" data-p="${c.p}">${MISSION.harvest}</button>`;
