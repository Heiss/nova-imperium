// The Sternenkarte renders as before #118, bundle 2 („no visible change“ of
// the issue; each migration step changes no behaviour, owner, 2026-11-13).
// The old view is frozen here: galaxy() of src/client/views/galaxy.ts with
// its helpers, and cd() of src/client/views/common.ts, which the component
// no longer uses. On generated states (fixed fast-check seed 118) both
// render the same markup, up to what a browser does not show (normalize()
// of markup.ts, the same as for the lists, the overview and the frame).
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { MISSION } from '../core/missions.ts';
import { placeName } from '../core/moon.ts';
import { placeId } from '../core/place.ts';
import type { Levels, Planet } from '../core/types.ts';
import { debrisAt, debrisMark, harvestButton } from '../client/logic/debris.ts';
import { coords, dur, esc, fmt } from '../client/logic/format.ts';
import { galaxyPage } from '../client/logic/galaxy.ts';
import { isProtected, nameOf, ranks } from '../client/logic/game.ts';
import { moonAt, moonMark, moonPicture } from '../client/logic/moon.ts';
import { canScan, scanRows, scanTitle } from '../client/logic/phalanx.ts';
import type { GalaxyPlanet, GameState } from '../client/logic/types.ts';
import { planetHTML, type Ui, type V } from '../client/views/common.ts';
import Galaxy from '../client/views/Galaxy.svelte';
import { planet, U } from './fixtures.ts';
import { normalize } from './markup.ts';

// ----- frozen: src/client/views/galaxy.ts before #118, bundle 2 -----

/** frozen: cd() of src/client/views/common.ts. */
const cd = (end: number, now: number): string =>
  end > now
    ? `<span class="cd" data-end="${end}">${dur(end - now)}</span>`
    : '<span class="dim">gleich …</span>';

const join = (...actions: string[]): string =>
  actions.filter(Boolean).join(' · ');

// One change on purpose (#189, the phone layer; the CSS shows it up to 760 px
// only): the actions of a row stand in a span, and a row with an action has a
// „⋯“ after it, which opens them in a bottom sheet. A row with nothing but
// the dim name of the active place has no „⋯“, and one without an action keeps
// its empty cell. What the sheet shows is tested in
// src/client/logic/galaxy.test.ts and src/client/views/galaxy.test.ts.
function actionCell(html: string, id: string, title: string): string {
  if (!html) return '<td></td>';
  if (!html.includes('data-act="'))
    return `<td><span class="gal-acts">${html}</span></td>`;
  return `<td class="has-sheet"><span class="gal-acts">${html}</span><button type="button" class="small more phone-only" id="gsheet-${esc(id)}" data-act="gsheet" data-id="${esc(id)}" aria-haspopup="dialog" aria-label="Aktionen für ${esc(title)}">⋯</button></td>`;
}

function planetActions(
  v: V,
  pl: GalaxyPlanet,
  mine: boolean,
  at: string,
): string {
  const id = pl.id;
  if (!mine)
    return join(
      `<span class="lnk" data-act="gspy" ${at}>Auspex-Erkundung</span> · <span class="lnk" data-act="gfleet" data-m="attack" ${at}>Sturmangriff</span> · <span class="lnk" data-act="gfleet" data-m="transport" ${at}>Versorgungsflug</span>`,
      scanButton(v, pl),
    );
  return id === v.P.id
    ? `<span class="dim">${pl.kind === 'moon' ? 'Aktiver Mond' : 'Aktiver Planet'}</span>`
    : `<button class="small" data-act="selectPlanet" data-id="${esc(id)}">Wechseln</button> · <button class="small" data-act="gfleet" data-m="transport" ${at}>Versorgungsflug</button> · <button class="small" data-act="gfleet" data-m="deploy" ${at}>${MISSION.deploy}</button>`;
}

const scanButton = (v: V, pl: GalaxyPlanet): string =>
  canScan(v.P, pl)
    ? `<button class="small" data-act="gscan" data-id="${esc(pl.id)}" aria-label="Phalanx-Scan von ${esc(pl.name)}">Phalanx-Scan</button>`
    : '';

function scanPanel(v: V): string {
  const scan = v.ui.scan;
  if (!scan || scan.by !== v.P.id) return '';
  const rows = scanRows(scan)
    .map(
      (r) =>
        `<tr><td>${esc(r.ships)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${cd(r.arr, v.now)}</td></tr>`,
    )
    .join('');
  const list = rows
    ? `<table class="scan"><tr><th>Schiffe</th><th>Herkunft</th><th>Ziel</th><th>Ankunft</th></tr>${rows}</table>`
    : '<p class="dim">Keine Flüge erfasst.</p>';
  return `<section class="bd scan-panel" id="scan" aria-labelledby="scan-h"><h3 id="scan-h" tabindex="-1">${esc(scanTitle(scan, v.s.galaxy))}</h3>${list}<button class="small" data-act="gscanClose">Schließen</button></section>`;
}

function ownerCell(v: V, pl: GalaxyPlanet, rk: Record<string, number>): string {
  const { s } = v;
  const mine = pl.owner === s.me.id;
  const prot = !mine && isProtected(s.players, s.me.id, pl.owner);
  return `<td>${esc(nameOf(s.players, pl.owner))} <span class="dim">(Platz ${rk[pl.owner] ?? '-'})</span>${prot ? ' <span class="good" title="Noobschutz">(n)</span>' : ''}</td>`;
}

function moonRow(v: V, moon: GalaxyPlanet, rk: Record<string, number>): string {
  const mine = moon.owner === v.s.me.id;
  const at = `data-g="${moon.g}" data-s="${moon.s}" data-p="${moon.p}" data-k="moon"`;
  const name = placeName(moon);
  return `<tr class="moon-row ${mine ? 'me' : ''}"><td class="n"></td><td><span class="gal-pl">${moonPicture(name, 28)}${esc(name)}</span></td>
   ${ownerCell(v, moon, rk)}${actionCell(planetActions(v, moon, mine, at), moon.id, `${name} ${coords(moon)}`)}</tr>`;
}

function row(v: V, p: number, rk: Record<string, number>): string {
  const { s, ui } = v;
  const c = { g: ui.gal, s: ui.sys, p };
  const pl = s.galaxy.find((x) => x.id === placeId({ ...c, kind: 'planet' }));
  const at = `data-g="${c.g}" data-s="${c.s}" data-p="${p}"`;
  const field = debrisAt(s.debris, c);
  const moon = moonAt(s.galaxy, c);
  const open = !!moon && ui.gmoon === moon.id;
  const mark =
    (moon ? ` ${moonMark(moon, open)}` : '') +
    (field ? ` ${debrisMark(field)}` : '');
  const harvest = field ? harvestButton(c) : '';
  if (!pl) {
    const colonize = v.P.ships.colony
      ? `<button class="small" data-act="gfleet" data-m="colonize" ${at}>Landnahme</button>`
      : '';
    return `<tr><td class="n">${p}</td><td colspan="2"><span class="dim">–</span>${mark}</td>${actionCell(join(colonize, harvest), `free-${p}`, `Position ${coords(c)}`)}</tr>`;
  }
  const mine = pl.owner === s.me.id;
  const moonLine = open ? moonRow(v, moon, rk) : '';
  return `<tr class="${mine ? 'me' : ''}"><td class="n">${p}</td><td><span class="gal-pl">${planetHTML(pl, true)}${esc(pl.name)}${mark}</span></td>
   ${ownerCell(v, pl, rk)}
   ${actionCell(join(planetActions(v, pl, mine, at), harvest), pl.id, `${pl.name} ${coords(pl)}`)}</tr>${moonLine}`;
}

function galaxy(v: V): string {
  const { s, ui } = v;
  const rk = ranks(s.players);
  const rows = Array.from({ length: s.cfg.positions }, (_, i) =>
    row(v, i + 1, rk),
  ).join('');
  return `<h2>Sternenkarte</h2><div class="box"><div class="bd flex">
  Galaxie <button class="small" data-act="gnav" data-d="g-" aria-label="vorige Galaxie">◀</button><input class="c3" type="number" id="g_g" data-nokeep value="${ui.gal}" min="1" max="${s.cfg.galaxies}" aria-label="Galaxie"><button class="small" data-act="gnav" data-d="g+" aria-label="nächste Galaxie">▶</button>
  System <button class="small" data-act="gnav" data-d="s-" aria-label="voriges System">◀</button><input class="c3" type="number" id="g_s" data-nokeep value="${ui.sys}" min="1" max="${s.cfg.systems}" aria-label="System"><button class="small" data-act="gnav" data-d="s+" aria-label="nächstes System">▶</button>
  <button data-act="ggo">Anzeigen</button> <span class="lnk" data-act="ghome">zum Heimatsystem</span></div>${scanPanel(v)}
  <table class="gal"><tr><th class="n">Pos</th><th>Planet</th><th>Spieler</th><th>Aktionen</th></tr>${rows}</table>
  <div class="bd dim">Auspex-Erkundung schickt ${fmt(s.me.probes || 1)} Spähschädel – einstellbar unter „Optionen“.</div></div>`;
}

// ----- the comparison -----

/**
 * The rows of the planet positions: the row of the expedition position
 * after them (#93) is new and tested in src/client/logic/galaxy.test.ts.
 */
const renderNew = (v: V): string => {
  const page = galaxyPage(v);
  return render(Galaxy, {
    props: { page: { ...page, rows: page.rows.slice(0, v.s.cfg.positions) } },
  }).body;
};

/**
 * Names with markup and quotes; the last becomes an attribute boundary when
 * its quotes are not escaped (CodeRabbit on #210).
 */
const NAMES = [
  'Heimat',
  'Kolonie',
  'Mond <b>&"\'</b>',
  'Ödland',
  'Nord" b="Süd',
] as const;
/** u1 is the player; u5 is unknown to the list of players. */
const OWNERS = ['u1', 'u2', 'u3', 'u4', 'u5'] as const;

/** A small part of the universe, so places, fields and the shown system meet. */
const coord = fc.record({
  g: fc.integer({ min: 1, max: 2 }),
  s: fc.integer({ min: 1, max: 3 }),
  p: fc.integer({ min: 1, max: U.positions }),
});
const time = fc.integer({ min: 0, max: 2_000_000 });

/** A planet, a moon alone, or a planet with its moon. */
const places = fc
  .record({
    kinds: fc.constantFrom<GalaxyPlanet['kind'][]>(
      ['planet'],
      ['moon'],
      ['planet', 'moon'],
    ),
    at: coord,
    name: fc.constantFrom(...NAMES),
    owner: fc.constantFrom(...OWNERS),
    temp: fc.integer({ min: -140, max: 160 }),
  })
  .map(({ kinds, at, ...p }): GalaxyPlanet[] =>
    kinds.map((kind) => ({
      ...p,
      ...at,
      kind,
      id: placeId({ ...at, kind }),
    })),
  );

const flight = fc.record({
  ships: fc.dictionary(
    fc.constantFrom('lc', 'probe', 'colony', 'bs', 'nope'),
    fc.integer({ min: 0, max: 5000 }),
  ),
  from: fc.constantFrom('p1_2_9', 'm1_2_6', 'x'),
  to: fc.constantFrom('p1_2_6', 'm2_1_3', 'p2_3_15'),
  arr: time,
});

const generated = fc.record({
  // The ids of the places are unique, as the server gives them.
  galaxy: fc
    .uniqueArray(places, { maxLength: 25, selector: (p) => p[0]!.id })
    .map((list) => {
      const seen = new Set<string>();
      return list.flat().filter((p) => !seen.has(p.id) && seen.add(p.id));
    }),
  debris: fc.array(
    fc.record({
      at: coord,
      m: fc.integer({ min: 0, max: 900_000 }),
      c: fc.integer({ min: 0, max: 900_000 }),
    }),
    { maxLength: 8 },
  ),
  // The shown place: one of the list, or one it does not know.
  shown: fc.record({
    pick: fc.nat(),
    known: fc.boolean(),
    kind: fc.constantFrom('planet' as const, 'moon' as const),
    at: coord,
    phalanx: fc.integer({ min: 0, max: 4 }),
    colony: fc.integer({ min: 0, max: 2 }),
  }),
  players: fc.dictionary(
    fc.constantFrom(...OWNERS.slice(0, 4)),
    fc.record({
      name: fc.constantFrom('Ich', 'Feind', 'Kain <i>&"\'</i>', 'Ödön'),
      points: fc.constantFrom(0, 10, 100, 499, 500, 501, 10_000),
    }),
  ),
  // The system of the shown place, or another one.
  home: fc.boolean(),
  gal: fc.integer({ min: 1, max: 2 }),
  sys: fc.integer({ min: 1, max: 3 }),
  gmoon: fc.nat(),
  open: fc.boolean(),
  scan: fc.option(
    fc.record({
      here: fc.boolean(),
      target: fc.constantFrom('p1_2_6', 'p1_1_3', 'm1_1_3', 'p9_9_9'),
      flights: fc.array(flight, { maxLength: 3 }),
    }),
  ),
  probes: fc.constantFrom(0, 1, 3, 1500),
  now: time,
});

type Generated = typeof generated extends fc.Arbitrary<infer T> ? T : never;

/** The shown place, one of the list (then the player's own) or another. */
function shownPlace(x: Generated): { galaxy: GalaxyPlanet[]; P: Planet } {
  const known = x.shown.known && x.galaxy.length > 0;
  const at = known ? x.shown.pick % x.galaxy.length : -1;
  const galaxy = x.galaxy.map((p, i) => (i === at ? { ...p, owner: 'u1' } : p));
  const from = galaxy[at];
  const P = planet({
    id: from?.id ?? placeId({ ...x.shown.at, kind: x.shown.kind }),
    kind: from?.kind ?? x.shown.kind,
    owner: 'u1',
    ...(from ? { g: from.g, s: from.s, p: from.p } : x.shown.at),
    b: { moonbase: 1, phalanx: x.shown.phalanx },
    ships: { colony: x.shown.colony },
  });
  return { galaxy, P };
}

/** The shown system, the open moon and the last scan. */
function uiOf(x: Generated, galaxy: GalaxyPlanet[], P: Planet): Ui {
  const gal = x.home ? P.g : x.gal;
  const sys = x.home ? P.s : x.sys;
  // Mostly a moon of the shown system is open, sometimes one elsewhere.
  const moons = galaxy.filter(
    (p) =>
      p.kind === 'moon' && (x.gmoon % 4 === 0 || (p.g === gal && p.s === sys)),
  );
  return {
    gal,
    sys,
    gmoon: x.open && moons.length ? moons[x.gmoon % moons.length]!.id : null,
    scan: x.scan && {
      by: x.scan.here ? P.id : 'm9_9_9',
      target: x.scan.target,
      flights: x.scan.flights.map((f) => ({ ...f, ships: f.ships as Levels })),
    },
  } as unknown as Ui;
}

const state = generated.map((x): V => {
  const { galaxy, P } = shownPlace(x);
  const s = {
    cfg: U,
    me: { id: 'u1', probes: x.probes },
    players: x.players,
    galaxy,
    debris: x.debris.map((d) => ({
      id: placeId({ ...d.at, kind: 'planet' }).replace('p', 'd'),
      ...d.at,
      m: d.m,
      c: d.c,
    })),
  } as unknown as GameState;
  const ui = uiOf(x, galaxy, P);
  return { s, P, R: { research: {}, rq: null }, now: x.now, ui };
});

/** Normalized markup of every branch of the Sternenkarte, for the check that the cases reach them. */
const MARKS = [
  'class="me"',
  'class="moon-row me"',
  'class="moon-row "',
  'aria-expanded="true"',
  'aria-expanded="false"',
  'class="debris"',
  'data-m="harvest"',
  'data-m="colonize"',
  'data-m="attack"',
  'data-m="deploy"',
  'data-act="gspy"',
  'data-k="moon"',
  'data-act="selectPlanet"',
  'data-act="gscan"',
  'Aktiver Planet',
  'Aktiver Mond',
  '(Platz -)',
  'Unbekannt <span',
  'title="Noobschutz"',
  'class="bd scan-panel"',
  'Keine Flüge erfasst.',
  'class="scan"',
  'class="cd"',
  'gleich …',
  '[?]',
  '(Mond)</td>',
  'Kain &lt;i>&amp;"\'&lt;/i>',
  'Mond &lt;b>&amp;"\'&lt;/b>',
  'aria-label="Phalanx-Scan von Nord&quot; b=&quot;Süd"',
  'schickt 1 Spähschädel',
  'schickt 1.500 Spähschädel',
  '<td colspan="2"><span class="dim">–</span></td><td></td>',
  'class="has-sheet"',
  'aria-label="Aktionen für ',
];

const SAMPLE = { seed: 118, numRuns: 300 };

describe('Galaxy against the view before #118, bundle 2', () => {
  it('renders the Sternenkarte as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(renderNew(v))).toBe(normalize(galaxy(v)));
      }),
      SAMPLE,
    );
  });

  it('reaches every branch', () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(state, (v) => {
        const html = normalize(renderNew(v));
        for (const mark of MARKS) if (html.includes(mark)) seen.add(mark);
      }),
      SAMPLE,
    );
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
