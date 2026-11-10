// Pieces shared by the views. Everything that comes from players goes through esc().
import type {
  Coords,
  Cost,
  Planet,
  ResearchState,
} from '../../shared/types.ts';
import { dur, esc, fmt } from '../logic/format.ts';
import { iconURL, type ResourceKey, resourceIconURL } from '../logic/icons.ts';
import { planetLook } from '../logic/planet.ts';
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
  auth: 'login' | 'register' | 'forgot' | 'reset' | 'code' | null;
  invite: { token: string; email: string; galaxies: number } | null;
  lastLink: string | null;
  /** Planet animations of this viewer (Hilfe & Optionen, issue #61 D9). */
  animations: boolean;
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
export const resIcon = (key: ResourceKey, name: string): string =>
  `<img class="ri" src="${resourceIconURL(key)}" alt="${name}" width="20" height="20">`;

export function costHTML(c: Cost, p: Planet, n = 1): string {
  const parts = COST_NAMES.map((name, i) => ({
    name,
    icon: resIcon(COST_ICONS[i]!, name),
    v: c[i]! * n,
    have: p.res[HAVE[i]!],
  }))
    .filter((x) => x.v > 0)
    .map(
      (x) =>
        `<span>${x.icon}<b class="${x.have >= x.v ? '' : 'bad'}">${fmt(x.v)}</b></span>`,
    );
  return `<div class="cost">${parts.join('')}</div>`;
}

export interface ItemDef {
  n: string;
  ab: string;
  ds?: string;
}

export function itemHTML(
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
  return `<div class="item"><div class="icon ${cls}">${icon}</div><div><div class="nm">${d.n} <span class="lv">${level}</span></div>${ds}${body}</div><div class="act">${action}</div></div>`;
}

export const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

export const needs = (miss: string[]): string =>
  miss.length ? `<div class="req">Benötigt: ${miss.join(', ')}</div>` : '';

/**
 * A layered planet (issue #61, D7): the surface turns, the clouds drift, the
 * atmosphere breathes. main.ts sets the textures from data-surface and
 * data-clouds (no inline styles under the CSP). `still` is for small planets.
 */
export function planetHTML(c: Coords, still = false): string {
  const look = planetLook(c);
  return `<div class="pl pl-${look.type}${still ? ' pl-still' : ''}" role="img" aria-label="${look.name}" data-surface="${look.surface}" data-clouds="${look.clouds}"><div class="pl-body"><div class="pl-surface"></div><div class="pl-clouds"></div><div class="pl-shade"></div></div></div>`;
}
