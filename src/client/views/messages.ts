import { BUILD, DEF, RES, SHIPS, UNIT } from '../../shared/catalog.ts';
import { countUnits } from '../../shared/flight.ts';
import type { Coords, Levels, Resources } from '../../shared/types.ts';
import { coords, dt, esc, fmt, resLine, techLine } from '../logic/format.ts';
import { newestFirst } from '../logic/game.ts';
import { updateMessageHTML } from '../logic/news.ts';
import type { Report } from '../logic/types.ts';
import type { V } from './common.ts';

function unitTable(before: Levels, after: Levels, keys: string[]): string {
  const ks = keys.filter((k) => (before[k] ?? 0) > 0);
  if (!ks.length) return '<span class="dim">keine Einheiten</span>';
  const rows = ks.map((k) => {
    const b = before[k]!;
    const a = after[k] ?? 0;
    return `<tr><td>${UNIT[k]?.n}</td><td class="n">${fmt(b)}</td><td class="n">${fmt(a)}</td><td class="n ${b - a > 0 ? 'bad' : ''}">${fmt(b - a)}</td></tr>`;
  });
  return `<table class="mini"><tr><th>Einheit</th><th class="n">vorher</th><th class="n">nachher</th><th class="n">Verlust</th></tr>${rows.join('')}</table>`;
}

const WINNER: Record<string, string> = {
  att: 'Der Angreifer hat die Schlacht gewonnen!',
  def: 'Der Verteidiger hat die Schlacht gewonnen!',
  draw: 'Die Schlacht endet unentschieden.',
};

const lv = (x: unknown): Levels => (x as Levels | undefined) ?? {};

function battleBody(r: Report): string {
  const rebuilt = lv(r.rebuilt);
  const loot = r.loot as Resources | undefined;
  const rb = countUnits(rebuilt)
    ? `<div class="dim">Wiederhergestellte Verteidigung: ${Object.entries(
        rebuilt,
      )
        .map(([k, n]) => `${fmt(n)} ${DEF[k]?.n}`)
        .join(', ')}</div>`
    : '';
  const lootLine =
    loot && loot.m + loot.c + loot.d ? `<br>Erbeutet: ${resLine(loot)}` : '';
  return `<div>Schlacht bei ${esc(r.name)} ${coords(r.coords as Coords)} · ${esc(r.rounds)} Runde(n)</div>
  <div class="cols mt"><div><b class="fl-attack">Angreifer ${esc(r.attName)}</b><div class="dim">${techLine(lv(r.attTech))}</div>${unitTable(lv(r.attBefore), lv(r.attAfter), Object.keys(SHIPS))}</div>
  <div><b class="good">Verteidiger ${esc(r.defName)}</b><div class="dim">${techLine(lv(r.defTech))}</div>${unitTable(lv(r.defBefore), lv(r.defAfter), Object.keys(UNIT))}${rb}</div></div>
  <p><b>${WINNER[String(r.winner)] ?? ''}</b>${lootLine}</p>`;
}

const NAMES: Record<string, { n: string }> = { ...UNIT, ...BUILD, ...RES };

function section(title: string, o: unknown, keys: string[]): string {
  if (!o) return '';
  const list = keys
    .filter((k) => (lv(o)[k] ?? 0) > 0)
    .map((k) => `${NAMES[k]?.n}: ${fmt(lv(o)[k])}`)
    .join(' · ');
  return `<div class="mt"><b>${title}</b><br>${list || '<span class="dim">keine</span>'}</div>`;
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
   ${section('Flotte', r.ships, Object.keys(SHIPS))}${section('Verteidigung', r.def, Object.keys(DEF))}${section('Gebäude', r.b, Object.keys(BUILD))}${section('Forschung', r.r, Object.keys(RES))}
   <div class="dim mt">Chance auf Spionageabwehr: ${esc(r.counter)} %${lost}${hint}</div>`;
}

function reportBody(r: Report): string {
  if (r.type === 'battle') return battleBody(r);
  if (r.type === 'spy') return spyBody(r);
  if (typeof r.news === 'string')
    return updateMessageHTML(String(r.text ?? ''), '?view=news');
  return `<div>${esc(r.text)}</div>`;
}

function reportHTML(v: V, r: Report, readAt: number): string {
  const cls = `rep ${r.time > readAt ? 'new' : ''} ${v.ui.openRep[r.id] ? 'open' : ''}`;
  return `<div class="${cls}" id="rep_${esc(r.id)}"><div class="t" data-act="toggleRep" data-id="${esc(r.id)}"><b>${esc(r.title)}</b><span class="dim">${dt(r.time)} <span class="lnk" data-act="delrep" data-id="${esc(r.id)}">löschen</span></span></div><div class="b">${reportBody(r)}</div></div>`;
}

export function messages(v: V): string {
  const readAt = v.s.me.readAt || 0;
  const list = newestFirst(v.s.reports);
  const del = list.length
    ? '<button class="small red" data-act="delall">Alle löschen</button>'
    : '';
  const body = list.length
    ? list.map((r) => reportHTML(v, r, readAt)).join('')
    : '<div class="bd dim">Keine Nachrichten.</div>';
  return `<h2>Nachrichten</h2><div class="box"><div class="hd flex between">Berichte (${list.length}) ${del}</div>${body}</div>`;
}
