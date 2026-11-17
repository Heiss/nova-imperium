// The fleet view renders as before #118, bundle 3 („no visible change“ of
// the issue; each migration step changes no behaviour, owner, 2026-11-13).
// The old view is frozen here: fleet() of src/client/views/fleet.ts with its
// helpers, as #240 left it, and box() and cd() of src/client/views/common.ts.
// On generated states (fixed fast-check seed 118) both render the same
// markup, up to what a browser does not show (normalize() of markup.ts, the
// same as for the lists, the overview, the frame and the Sternenkarte).
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { canFly, RES, SHIPS } from '../core/catalog.ts';
import { fleetSlots, shipSpeed } from '../core/flight.ts';
import { MISSION } from '../core/missions.ts';
import { placeId } from '../core/place.ts';
import { text } from '../core/text.ts';
import type { Levels, Mission } from '../core/types.ts';
import { fleetPage } from '../client/logic/fleet.ts';
import { esc, fmt } from '../client/logic/format.ts';
import { moonAt } from '../client/logic/moon.ts';
import { type FleetRow, fleetRows } from '../client/logic/overview.ts';
import type { GalaxyPlanet, GameState } from '../client/logic/types.ts';
import { box, cd, type Ui, type V } from '../client/views/common.ts';
import Fleet from '../client/views/Fleet.svelte';
import { planet, U } from './fixtures.ts';
import { normalize } from './markup.ts';

// ----- frozen: src/client/views/fleet.ts before #118, bundle 3 -----

const fleetText = (row: FleetRow): string =>
  row.parts.map((p) => (p.bold ? `<b>${esc(p.text)}</b>` : p.text)).join('');

function fleetRow(v: V, row: FleetRow): string {
  const button = row.recall
    ? `<button class="small" data-act="recall" data-id="${esc(row.id)}">Rückruf</button>`
    : '';
  return `<tr><td class="n w110">${cd(row.due.end, v.now)}</td><td class="${row.cls}">${fleetText(row)}</td><td class="w80">${button}</td></tr>`;
}

function fleetTable(v: V): string {
  const list = fleetRows(v, false);
  return list.length
    ? `<table>${list.map((row) => fleetRow(v, row)).join('')}</table>`
    : '<span class="dim">Keine Flottenbewegungen.</span>';
}

function shipRows(v: V): string {
  const { P, R } = v;
  return Object.entries(SHIPS)
    .filter(([k]) => (P.ships[k] ?? 0) > 0 && canFly(k))
    .map(
      ([k]) =>
        `<tr><td>${text(k)!.n}</td><td class="n">${fmt(P.ships[k])}</td><td class="n">${fmt(shipSpeed(k, R))}</td><td><input type="number" min="0" class="fs" id="f_${k}" data-k="${k}" placeholder="0" aria-label="Anzahl ${text(k)!.n}"> <span class="lnk" data-act="fmax" data-k="${k}">max</span></td></tr>`,
    )
    .join('');
}

const CARGO = [
  ['m', 'Adamant'],
  ['c', 'Psikristall'],
  ['d', 'Promethium'],
] as const;

const cargoFields = CARGO.map(
  ([k, name]) =>
    `<span class="cargo"><input type="number" id="c_${k}" min="0" placeholder="0" aria-label="${name}"><button type="button" id="cone_${k}" class="small" data-act="cone" data-k="${k}" aria-label="Alles ${name}">alles</button></span>`,
).join(' ');

function targetForm(v: V, slotsFull: boolean): string {
  const { P, s, ui } = v;
  const t = ui.ft ?? { g: P.g, s: P.s, p: P.p };
  const u = s.cfg;
  const moon = !!moonAt(s.galaxy, t);
  const toMoon = moon && t.kind === 'moon';
  const kinds = `<select id="t_k" aria-label="Zielart"><option value="planet">Planet</option><option value="moon"${moon ? '' : ' disabled'}${toMoon ? ' selected' : ''}>Mond</option></select>`;
  const missions = Object.entries(MISSION)
    .map(
      ([k, name]) =>
        `<option value="${k}" ${ui.fm === k ? 'selected' : ''}>${name}</option>`,
    )
    .join('');
  const speeds = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    .map((x) => `<option value="${x}">${x * 10} %</option>`)
    .join('');
  return `<table class="kv">
  <tr><td>Ziel</td><td><input class="c3" type="number" id="t_g" value="${t.g}" min="1" max="${u.galaxies}" aria-label="Galaxie">:<input class="c3" type="number" id="t_s" value="${t.s}" min="1" max="${u.systems}" aria-label="System">:<input class="c3" type="number" id="t_p" value="${t.p}" min="1" max="${u.positions}" aria-label="Position"> ${kinds} <span id="t_info" class="dim"></span></td></tr>
  <tr><td>Auftrag</td><td><select id="t_m" aria-label="Auftrag">${missions}</select></td></tr>
  <tr><td>Geschwindigkeit</td><td><select id="t_v" aria-label="Geschwindigkeit">${speeds}</select></td></tr>
  <tr><td>Ladung (Adamant / Psikristall / Promethium)</td><td>${cargoFields} <span class="lnk" data-act="cmax">alles (gleichmäßig)</span></td></tr>
  <tr><td>Entfernung</td><td id="i_dist">-</td></tr><tr><td>Flugdauer (eine Richtung)</td><td id="i_dur">-</td></tr>
  <tr><td>Ankunft / Rückkehr</td><td id="i_arr">-</td></tr><tr><td>Treibstoff</td><td id="i_fuel">-</td></tr><tr><td>Laderaum</td><td id="i_cap">-</td></tr>
 </table><div class="mt10"><button data-act="send" ${slotsFull ? 'disabled' : ''}>Flotte losschicken</button> ${slotsFull ? '<span class="bad">Alle Flottenslots belegt (Kogitator-Doktrin erhöht die Anzahl).</span>' : ''}</div>`;
}

function fleet(v: V): string {
  const slots = fleetSlots(v.R);
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && !f.gift,
  ).length;
  const rows = shipRows(v);
  const head = box(
    `Flotten unterwegs (${used} / ${slots} Slots)`,
    fleetTable(v),
  );
  if (!rows)
    return `<h2>Flotte</h2>${head}<div class="notice">Auf diesem Planeten stehen keine Schiffe. Baue welche in der Schiffsschmiede.</div>`;
  const pick = `<table><tr><th>Schiff</th><th class="n">vorhanden</th><th class="n">Tempo</th><th>Anzahl</th></tr>${rows}</table>
  <div class="mt"><span class="lnk" data-act="fall">alle Schiffe</span> · <span class="lnk" data-act="fnone">keine Schiffe</span></div>`;
  return `<h2>Flotte</h2>${head}${box('1. Schiffe auswählen', pick)}${box('2. Ziel und Auftrag', targetForm(v, used >= slots))}`;
}

// ----- the comparison -----

const renderNew = (v: V): string =>
  render(Fleet, { props: { page: fleetPage(v) } }).body;

/** u1 is the player; u5 is unknown to the list of players. */
const OWNERS = ['u1', 'u2', 'u3', 'u5'] as const;

const time = fc.integer({ min: 0, max: 2_000_000 });
/** A small part of the universe, so the target meets the places. */
const coord = fc.record({
  g: fc.integer({ min: 1, max: 2 }),
  s: fc.integer({ min: 1, max: 2 }),
  p: fc.integer({ min: 1, max: 4 }),
});

const levels = (keys: string[], max: number): fc.Arbitrary<Levels> =>
  fc.record(
    Object.fromEntries(keys.map((k) => [k, fc.integer({ min: 0, max })])),
    { requiredKeys: [] },
  ) as fc.Arbitrary<Levels>;

const flight = fc.record({
  owner: fc.constantFrom(...OWNERS),
  fromC: coord,
  toC: coord,
  mission: fc.constantFrom(...(Object.keys(MISSION) as Mission[])),
  state: fc.constantFrom('out' as const, 'back' as const),
  arr: time,
  ret: fc.option(time, { nil: undefined }),
  ships: fc.option(levels(Object.keys(SHIPS), 3000), { nil: undefined }),
  gift: fc.option(fc.constant(true as const), { nil: undefined }),
});

/** A planet, or a planet with its moon. */
const places = fc
  .record({ moon: fc.boolean(), at: coord, owner: fc.constantFrom(...OWNERS) })
  .map(({ moon, at, owner }): GalaxyPlanet[] =>
    (moon ? (['planet', 'moon'] as const) : (['planet'] as const)).map(
      (kind) => ({
        ...at,
        kind,
        owner,
        id: placeId({ ...at, kind }),
        name: 'Ort',
        temp: 20,
      }),
    ),
  );

const generated = fc.record({
  at: coord,
  // Mostly some ships, sometimes none or only ones that cannot fly.
  ships: fc.oneof(
    levels(Object.keys(SHIPS), 2_000_000),
    fc.constant({} as Levels),
    fc.constant({ sat: 4 } as Levels),
  ),
  research: levels(Object.keys(RES), 12),
  fleets: fc.array(flight, { maxLength: 6 }),
  galaxy: fc.uniqueArray(places, { maxLength: 8, selector: (p) => p[0]!.id }),
  target: fc.option(
    fc.record({
      at: coord,
      kind: fc.constantFrom('planet' as const, 'moon' as const, undefined),
    }),
  ),
  mission: fc.constantFrom(...Object.keys(MISSION), 'nope'),
  now: time,
});

const state = generated.map((x): V => {
  const s = {
    cfg: U,
    me: { id: 'u1' },
    players: { u1: { name: 'Ich' }, u2: { name: 'Feind' } },
    // Fleet ids are unique, as the server gives them.
    fleets: x.fleets.map((f, i) => ({
      ...f,
      id: `f${i}`,
      to: '',
      ships: f.ships as Levels,
    })),
    galaxy: x.galaxy.flat(),
  } as unknown as GameState;
  const ui = {
    ft: x.target && { ...x.target.at, kind: x.target.kind },
    fm: x.mission,
  } as unknown as Ui;
  return {
    s,
    P: planet({ ...x.at, ships: x.ships }),
    R: { research: x.research, rq: null },
    now: x.now,
    ui,
  };
});

/** Normalized markup of every branch of the fleet view, for the check that the cases reach them. */
const MARKS = [
  'Keine Flottenbewegungen.',
  'data-act="recall"',
  'class="cd"',
  'gleich …',
  'Auf diesem Planeten stehen keine Schiffe.',
  'data-act="fmax"',
  'id="f_lc"',
  '<option value="moon">Mond',
  '<option disabled value="moon">Mond',
  '<option selected value="moon">Mond',
  '<option selected value="attack">',
  '<option selected value="harvest">',
  'data-act="send" disabled>',
  'data-act="send">',
  'Alle Flottenslots belegt',
  ' / 1 Slots)',
  ' / 13 Slots)',
];

const SAMPLE = { seed: 118, numRuns: 300 };

describe('Fleet against the view before #118, bundle 3', () => {
  it('renders the fleet view as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(renderNew(v))).toBe(normalize(fleet(v)));
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
