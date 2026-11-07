// Pieces shared by the views. Everything that comes from players goes through esc().
import type { Cost, Planet, ResearchState } from '../../shared/types.ts';
import { artURI } from '../art.ts';
import { dur, esc, fmt } from '../logic/format.ts';
import type { GameState } from '../logic/types.ts';

export interface Ui {
  view: string;
  gal: number;
  sys: number;
  ft: { g: number; s: number; p: number } | null;
  fm: string;
  openRep: Record<string, boolean>;
  auth: 'login' | 'register' | 'forgot' | 'reset' | 'code' | null;
  invite: { token: string; email: string; galaxies: number } | null;
  lastLink: string | null;
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
const HAVE = ['m', 'c', 'd'] as const;

export function costHTML(c: Cost, p: Planet, n = 1): string {
  const parts = COST_NAMES.map((name, i) => ({
    name,
    v: c[i]! * n,
    have: p.res[HAVE[i]!],
  }))
    .filter((x) => x.v > 0)
    .map(
      (x) =>
        `<span>${x.name}: <b class="${x.have >= x.v ? '' : 'bad'}">${fmt(x.v)}</b></span>`,
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
  const src = artURI(key);
  const icon = src ? `<img src="${src}" alt="${esc(d.n)}">` : d.ab;
  const ds = d.ds ? `<div class="ds">${d.ds}</div>` : '';
  return `<div class="item"><div class="icon ${cls}">${icon}</div><div><div class="nm">${d.n} <span class="lv">${level}</span></div>${ds}${body}</div><div class="act">${action}</div></div>`;
}

export const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

export const needs = (miss: string[]): string =>
  miss.length ? `<div class="req">Benötigt: ${miss.join(', ')}</div>` : '';

/** A planet ball; main.ts paints it from data-temp (no inline styles under the CSP). */
export const planetBall = (temp: number, cls = 'planet'): string =>
  `<div class="${cls}" data-temp="${temp}"></div>`;
