// The bodies of the reports of battles, espionage and surveys as HTML
// (moved from views/messages.ts, #118, bundle 4).
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
import { coords, esc, fmt, resLine, techLine } from './format.ts';
import { surveyBody } from './survey.ts';
import type { Report } from './types.ts';

function unitTable(before: Levels, after: Levels, keys: string[]): string {
  const ks = keys.filter((k) => (before[k] ?? 0) > 0);
  if (!ks.length) return '<span class="dim">keine Einheiten</span>';
  const rows = ks.map((k) => {
    const b = before[k]!;
    const a = after[k] ?? 0;
    return `<tr><td>${text(k)?.n}</td><td class="n">${fmt(b)}</td><td class="n">${fmt(a)}</td><td class="n ${b - a > 0 ? 'bad' : ''}">${fmt(b - a)}</td></tr>`;
  });
  return `<table class="mini"><tr><th>Einheit</th><th class="n">vorher</th><th class="n">nachher</th><th class="n">Verlust</th></tr>${rows.join('')}</table>`;
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

/** Each fleet that held fights as a defender of its own (#55). */
const heldSides = (r: Report): string =>
  ((r.held as HeldSide[] | undefined) ?? [])
    .map(
      (h) =>
        `<div><b class="good">Verteidiger ${esc(h.name)}</b><div class="dim">${techLine(lv(h.tech))}</div>${unitTable(lv(h.before), lv(h.after), Object.keys(SHIPS))}</div>`,
    )
    .join('');

function battleBody(r: Report): string {
  const rebuilt = lv(r.rebuilt);
  const loot = r.loot as Resources | undefined;
  const rb = countUnits(rebuilt)
    ? `<div class="dim">Wiederhergestellte Verteidigung: ${Object.entries(
        rebuilt,
      )
        .map(([k, n]) => `${fmt(n)} ${text(k)?.n}`)
        .join(', ')}</div>`
    : '';
  const lootLine =
    loot && loot.m + loot.c + loot.d ? `<br>Erbeutet: ${resLine(loot)}` : '';
  const debris = debrisLine(r.debris as Debris | undefined);
  const debrisHTML = [debris, ...moonLines(r), ...moonbreakLines(r)]
    .filter(Boolean)
    .map((line) => `<br>${line}`)
    .join('');
  return `<div>Schlacht bei ${esc(r.name)} ${coords(r.coords as Coords)} · ${esc(r.rounds)} Runde(n)</div>
  <div class="cols mt"><div><b class="fl-attack">Angreifer ${esc(r.attName)}</b><div class="dim">${techLine(lv(r.attTech))}</div>${unitTable(lv(r.attBefore), lv(r.attAfter), Object.keys(SHIPS))}</div>
  <div><b class="good">Verteidiger ${esc(r.defName)}</b><div class="dim">${techLine(lv(r.defTech))}</div>${unitTable(lv(r.defBefore), lv(r.defAfter), Object.keys(UNIT))}${rb}</div>${heldSides(r)}</div>
  <p><b>${WINNER[String(r.winner)] ?? ''}</b>${lootLine}${debrisHTML}</p>`;
}

function section(title: string, o: unknown, keys: string[]): string {
  if (!o) return '';
  const list = unitList(lv(o), keys);
  return `<div class="mt"><b>${title}</b><br>${list || '<span class="dim">keine</span>'}</div>`;
}

/** The activity of the target, in reports since #175. */
function spyActivity(r: Report): string {
  const words = spyActivityText(
    r.activity as PlanetActivity | null | undefined,
  );
  return words === null
    ? ''
    : `<div class="mt"><b>Aktivität</b><br>${esc(words)}</div>`;
}

/** The ships of a section, „Name: n · …“, or none. */
const unitList = (o: Levels, keys: string[]): string =>
  keys
    .filter((k) => (o[k] ?? 0) > 0)
    .map((k) => `${text(k)?.n}: ${fmt(o[k])}`)
    .join(' · ');

/**
 * The fleets that hold at the planet, apart from its fleet, when the spy's
 * Auspex-Lehre reaches the round's level (#55, owner, 2026-11-17).
 */
function heldSection(r: Report): string {
  const held = r.held as { name: string; ships: Levels }[] | undefined;
  if (!held?.length) return '';
  const rows = held
    .map(
      (h) =>
        `${esc(h.name)}: ${unitList(lv(h.ships), Object.keys(SHIPS)) || '<span class="dim">keine</span>'}`,
    )
    .join('<br>');
  return `<div class="mt"><b>Gehaltene Flotten</b><br>${rows}</div>`;
}

function spyBody(r: Report): string {
  const lost = r.lost
    ? ' – <span class="bad">deine Spähschädel wurden zerstört!</span>'
    : '';
  const hint =
    !r.ships && !r.lost
      ? ' · Mehr Spähschädel oder Auspex-Lehre zeigen mehr Details.'
      : '';
  return `<div>Rohstoffe auf ${esc(r.name)} ${coords(r.coords as Coords)} (Spieler ${esc(r.defName)}):<br><b>${resLine(r.res as Resources)}</b></div>
   ${spyActivity(r)}${section('Flotte', r.ships, Object.keys(SHIPS))}${heldSection(r)}${section('Verteidigung', r.def, Object.keys(DEF))}${section('Gebäude', r.b, Object.keys(BUILD))}${section('Forschung', r.r, Object.keys(RES))}
   <div class="dim mt">Chance auf Auspex-Abwehr: ${esc(r.counter)} %${lost}${hint}</div>`;
}

/**
 * The body of a battle, espionage or survey report as HTML (their tables and
 * sections), or null for a report that is only text. The list of reports
 * (#118, bundle 4: logic/messages.ts, Messages.svelte) renders these bodies
 * with `{@html}` until they are components of their own.
 */
export function reportBodyHTML(r: Report): string | null {
  if (r.type === 'battle') return battleBody(r);
  if (r.type === 'spy') return spyBody(r);
  if (r.type === 'survey') return surveyBody(r);
  return null;
}
