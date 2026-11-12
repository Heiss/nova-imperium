import type { NewsData } from '../logic/news.ts';
// Pieces shared by the views. Everything that comes from players goes through esc().
import type {
  Coords,
  Cost,
  Planet,
  Requirements,
  ResearchState,
} from '../../shared/types.ts';
import { dur, esc, fmt } from '../logic/format.ts';
import {
  explainButtonHTML,
  explainPanelHTML,
  explanation,
} from '../logic/explain.ts';
import { iconURL, type ResourceKey, resourceIconURL } from '../logic/icons.ts';
import { planetLook } from '../logic/planet.ts';
import {
  type Need,
  type NeedState,
  needState,
  type Places,
  unmetRequirements,
} from '../../shared/requirements.ts';
import { production } from '../../shared/economy.ts';
import type { GameState } from '../logic/types.ts';

export interface Ui {
  passwordMinLength?: number;
  view: string;
  guild?: string | null;
  gal: number;
  sys: number;
  ft: { g: number; s: number; p: number } | null;
  fm: string;
  openRep: Record<string, boolean>;
  /** Entries whose explanation the player opened with the (?) (issue #63). */
  openEx: Record<string, boolean>;
  auth: 'login' | 'register' | 'forgot' | 'reset' | 'code' | null;
  invite: { token: string; email: string; galaxies: number } | null;
  lastLink: string | null;
  /** Planet animations of this viewer (Hilfe & Optionen, issue #61 D9). */
  animations: boolean;
  /** „Neuigkeiten“ from the server, null until loaded (issue #81). */
  news: NewsData | null;
  /** The newest version whose news were opened on this device. */
  newsSeen: string | null;
}

/** What every view gets: the state, the planet and research moved to now. */
export interface V {
  s: GameState;
  P: Planet;
  R: ResearchState;
  now: number;
  ui: Ui;
}

/** A countdown; the clock in main.ts updates it every second. */
export const cd = (end: number, now: number): string =>
  end > now
    ? `<span class="cd" data-end="${end}">${dur(end - now)}</span>`
    : '<span class="dim">gleich …</span>';

const COST_NAMES = ['Metall', 'Kristall', 'Deuterium'] as const;
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

export interface ItemDef {
  n: string;
  ab: string;
  ds?: string;
  lt?: string;
}

/**
 * A row of research, shipyard or defense. The short `ds` is always shown
 * (issue #63, D5); the explanation follows the display mode of the player.
 */
export function itemHTML(
  v: V,
  cls: string,
  key: string,
  d: ItemDef,
  level: string,
  body: string,
  action: string,
): string {
  const src = iconURL(key);
  const icon = src ? `<img src="${src}" alt="${esc(d.n)}">` : d.ab;
  const ds = d.ds ? `<div class="ds">${d.ds}</div>` : '';
  const ex = explanation(key, d, v.s.me.explain, v.ui.openEx);
  return `<div class="item"><div class="icon ${cls}">${icon}</div><div><div class="nm">${d.n} <span class="lv">${level}</span>${explainButtonHTML(ex)}</div>${ds}${body}${explainPanelHTML(ex)}</div><div class="act">${action}</div></div>`;
}

export const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

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
