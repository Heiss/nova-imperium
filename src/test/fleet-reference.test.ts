// The fleet view renders as before #118, bundle 3 („no visible change“ of
// the issue; each migration step changes no behaviour, owner, 2026-11-13).
// The old view is frozen here: fleet() of src/client/views/fleet.ts with its
// helpers and the markup of src/client/views/union.ts, as #93, #225, #230,
// #253 and #292 left them, and box() and cd() of src/client/views/common.ts.
// On generated states (fixed fast-check seed 118) both render the same
// markup, up to what a browser does not show (normalize() of markup.ts, the
// same as for the lists, the overview, the frame and the Sternenkarte);
// hand-built cases reach the branches the sample reaches rarely.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canFly, RES, SHIPS } from '../core/catalog.ts';
import {
  expeditionLevel,
  expeditionSlots,
  extraSlots,
} from '../core/expedition.ts';
import { fleetSlots, shipSpeed } from '../core/flight.ts';
import { HOLD_HOURS } from '../core/holding.ts';
import { isFleet, MISSION, missionRules } from '../core/missions.ts';
import { placeId } from '../core/place.ts';
import type { RoundRules } from '../core/round.ts';
import { text } from '../core/text.ts';
import type { Levels, Mission } from '../core/types.ts';
import { colonyNote } from '../client/logic/colony-limit.ts';
import {
  maxPosition,
  missionOptions,
  offeredMissions,
  QUICK_FIRST,
  type QuickTarget,
  quickTargets,
} from '../client/logic/fleet-target.ts';
import { esc, fmt } from '../client/logic/format.ts';
import { maxStay, staysAt } from '../client/logic/game.ts';
import { jumpPanel } from '../client/logic/jump-gate.ts';
import { moonAt } from '../client/logic/moon.ts';
import { type FleetRow, fleetRows } from '../client/logic/overview.ts';
import { joinChoices, openRows, unionRows } from '../client/logic/union.ts';
import type {
  ClientFleet,
  GalaxyPlanet,
  GameState,
  UnionState,
} from '../client/logic/types.ts';
import { box, cd, type Ui, type V } from '../client/views/common.ts';
import { fleetView } from './fleet-view.ts';
import { planet, roundDefaults, U } from './fixtures.ts';
import { normalize } from './markup.ts';

// ----- frozen: quickOptions() of src/client/logic/fleet-target.ts -----

const quickOptions = (list: readonly QuickTarget[]): string =>
  [
    `<option value="">${QUICK_FIRST}</option>`,
    ...list.map((q) => `<option value="${esc(q.id)}">${esc(q.label)}</option>`),
  ].join('');

// ----- frozen: src/client/views/union.ts before #118, bundle 3 -----

/**
 * The own Sturmangriffe on their way that can open a union, each with its
 * button; the recall of the fleet that opened a union turns back the whole
 * union (owner, 2026-11-16, Q2), a participant's only his own.
 */
function openList(v: V): string {
  const rows = openRows(v);
  if (!rows.length) return '';
  const list = rows
    .map(
      (f) =>
        `<tr><td>Sturmangriff auf ${esc(f.target)}</td><td class="n w110">${cd(f.arr, v.now)}</td><td><button class="small" data-act="openUnion" data-id="${esc(f.id)}">Angriffsverband eröffnen</button></td></tr>`,
    )
    .join('');
  return `<table class="mt">${list}</table>`;
}

/** The box „Verbandsangriff“; nothing while no union concerns the player and no attack can open one. */
function unionBox(v: V): string {
  const rows = unionRows(v);
  const open = openList(v);
  if (!rows.length && !open) return '';
  const list = rows.map((u) => {
    const id = esc(u.id);
    const invite = u.leads
      ? `<div class="mt"><input type="text" id="un_name_${id}" maxlength="20" placeholder="Spielername" aria-label="Spieler zum Angriffsverband einladen"> <button class="small" data-act="inviteUnion" data-id="${id}">Einladen</button></div>`
      : '';
    const invited = u.invited
      ? `<div class="dim">Eingeladen: ${esc(u.invited)}</div>`
      : '';
    return `<div class="union" id="un_${id}"><b>${esc(u.title)}</b> · Anführer ${esc(u.leader)} · Ankunft in ${cd(u.arr, v.now)}
<div class="dim">${esc(u.counts)}</div><div>Flotten: ${esc(u.fleets)}</div>${invited}${invite}
<div class="mt"><button class="small" data-act="joinUnion" data-id="${id}">Beitreten</button></div></div>`;
  });
  const hint = rows.length
    ? '<div class="dim mt">Ruft der Anführer seine Flotte zurück, kehren alle Flotten des Verbands um; ein Beteiligter ruft nur seine eigene zurück.</div>'
    : '';
  return box('Verbandsangriff', list.join('') + open + hint);
}

/** The row „Verband“ of the fleet form: the unions the fleet can join, none preselected unless chosen. */
function unionFormRow(v: V): string {
  const choices = joinChoices(v);
  if (!choices.length) return '';
  const options = choices
    .map(
      (c) =>
        `<option value="${esc(c.id)}"${v.ui.union === c.id ? ' selected' : ''}>${esc(c.label)}</option>`,
    )
    .join('');
  return `<tr id="t_union_row"><td><label for="t_u">Verband</label></td><td><select id="t_u"><option value="">Kein Verband</option>${options}</select></td></tr>`;
}

// ----- frozen: src/client/views/fleet.ts before #118, bundle 3 -----

const fleetText = (row: FleetRow): string =>
  row.parts.map((p) => (p.bold ? `<b>${esc(p.text)}</b>` : p.text)).join('');

function fleetRow(v: V, row: FleetRow): string {
  const button = row.recall
    ? `<button class="small" data-act="recall" data-id="${esc(row.id)}">Rückruf</button>`
    : '';
  return `<tr><td class="n w110">${cd(row.due.end, v.now)}</td><td class="${row.cls}">${fleetText(row)}</td><td class="w80">${button}</td></tr>`;
}

/** The fleet movements of the player, as the overview shows them (#118). */
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

/** „1 Stunde“, „2 Stunden“. */
const hours = (h: number): string => (h === 1 ? '1 Stunde' : `${h} Stunden`);

/**
 * The row „Haltezeit“ (#55): the classic holding times, 1 hour preselected
 * [V]; shown only while the chosen mission holds (main.ts switches it).
 */
function holdRow(mission: string): string {
  const options = HOLD_HOURS.map(
    (h) =>
      `<option value="${h}"${h === 1 ? ' selected' : ''}>${hours(h)}</option>`,
  ).join('');
  const hidden = missionRules(mission)?.holds ? '' : ' hidden';
  return `<tr id="t_hold"${hidden}><td><label for="t_h">Haltezeit</label></td><td><select id="t_h">${options}</select></td></tr>`;
}

/**
 * The row „Haltezeit“ of an expedition (#93): whole hours from 1 to the most
 * the research and the round allow, at the target. With the universe speed
 * dividing the stay, `timeRow` adds the real time beside it. It is a row of
 * its own with its own field `t_stay`, apart from the Halten (`t_hold`,
 * `t_h`): only one of the two is in the form, so no label exists twice.
 */
function stayRow(mission: string, v: Pick<V, 'R' | 's'>): string {
  const most = Math.max(1, maxStay(mission, v.R.research, v.s.cfg));
  return `<tr id="t_stay_row"><td>Haltezeit</td><td><input class="c3" type="number" id="t_stay" min="1" max="${most}" value="1" aria-label="Haltezeit in Stunden"> Stunden am Ziel <span id="t_real" class="dim"></span></td></tr>`;
}

/** The row of the time at the target for the mission: the stay of an expedition or the holding time of a Halten (hidden for the others). */
const timeRowHtml = (mission: string, v: Pick<V, 'R' | 's'>): string =>
  staysAt(mission) ? stayRow(mission, v) : holdRow(mission);

const CARGO = [
  ['m', 'Adamant'],
  ['c', 'Psikristall'],
  ['d', 'Promethium'],
] as const;

// Each cargo field with its own „alles“ below it (#240).
const cargoFields = CARGO.map(
  ([k, name]) =>
    `<span class="cargo"><input type="number" id="c_${k}" min="0" placeholder="0" aria-label="${name}"><button type="button" id="cone_${k}" class="small" data-act="cone" data-k="${k}" aria-label="Alles ${name}">alles</button></span>`,
).join(' ');

function targetForm(v: V, slotsFull: boolean): string {
  const { P, s, ui } = v;
  const t = ui.ft ?? { g: P.g, s: P.s, p: P.p };
  const u = s.cfg;
  // „Mond“ only where one is (#53); main.ts updates it with the coordinates.
  const moon = !!moonAt(s.galaxy, t);
  const toMoon = moon && t.kind === 'moon';
  const kinds = `<select id="t_k" aria-label="Zielart"><option value="planet">Planet</option><option value="moon"${moon ? '' : ' disabled'}${toMoon ? ' selected' : ''}>Mond</option></select>`;
  // Only the missions that fit the target (#253); missiles start in the
  // Sternenkarte, not here (#54).
  const { html: missions, selected } = missionOptions(
    offeredMissions(s, P.id, t, v.now),
    ui.fm,
  );
  const quick = quickTargets(s, P.id);
  const speeds = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    .map((x) => `<option value="${x}">${x * 10} %</option>`)
    .join('');
  return `<table class="kv">
  <tr><td><label for="t_q">Schnellwahl</label></td><td><select id="t_q"${quick.length ? '' : ' disabled'}>${quickOptions(quick)}</select></td></tr>
  <tr><td>Ziel</td><td><input class="c3" type="number" id="t_g" value="${t.g}" min="1" max="${u.galaxies}" aria-label="Galaxie">:<input class="c3" type="number" id="t_s" value="${t.s}" min="1" max="${u.systems}" aria-label="System">:<input class="c3" type="number" id="t_p" value="${t.p}" min="1" max="${maxPosition(s)}" aria-label="Position"> ${kinds} <span id="t_info" class="dim"></span></td></tr>
  <tr><td>Auftrag</td><td><select id="t_m" aria-label="Auftrag">${missions}</select> <span id="t_limit" class="dim">${esc(colonyNote(s, selected))}</span></td></tr>${unionFormRow(v)}
  ${timeRowHtml(selected, v)}
  <tr><td>Geschwindigkeit</td><td><select id="t_v" aria-label="Geschwindigkeit">${speeds}</select></td></tr>
  <tr><td>Ladung (Adamant / Psikristall / Promethium)</td><td>${cargoFields} <span class="lnk" data-act="cmax">alles (gleichmäßig)</span></td></tr>
  <tr><td>Entfernung</td><td id="i_dist">-</td></tr><tr><td>Flugdauer (eine Richtung)</td><td id="i_dur">-</td></tr>
  <tr><td>Ankunft / Rückkehr</td><td id="i_arr">-</td></tr><tr><td>Treibstoff</td><td id="i_fuel">-</td></tr><tr><td>Laderaum</td><td id="i_cap">-</td></tr>
 </table><div class="mt10"><button id="t_send" data-act="send" data-full="${slotsFull ? '1' : ''}" ${slotsFull || !selected ? 'disabled' : ''}>Flotte losschicken</button> ${slotsFull ? '<span class="bad">Alle Flottenslots belegt (Kogitator-Doktrin erhöht die Anzahl).</span>' : ''}</div>`;
}

/**
 * The box „Warp-Tor“ on a moon with one (#230): the ships picked above jump
 * to the „Zielmond“; a cooling gate says when it is ready again.
 */
function jumpBox(v: V): string {
  const panel = jumpPanel(v.s, v.P, v.now);
  if (!panel) return '';
  const options = panel.targets
    .map(
      (t) =>
        `<option value="${esc(t.id)}"${t.disabled ? ' disabled' : ''}>${esc(t.label)}</option>`,
    )
    .join('');
  const select = `<select id="jg_to" class="jump-to"${panel.targets.length ? '' : ' disabled'}>${options}</select>`;
  const wait =
    panel.cooling === null
      ? ''
      : ` <span class="dim">Wieder bereit in ${cd(panel.cooling, v.now)}</span>`;
  return box(
    'Warp-Tor',
    `<div><label for="jg_to">Zielmond</label> ${select}</div><div class="mt10"><button data-act="jump"${panel.canJump ? '' : ' disabled'}>Springen</button>${wait}</div>`,
  );
}

/**
 * „ · Expeditionen (n / m)“ once the research is there (#93): the own fleets
 * of a mission that stays against the slots the level allows.
 */
function expeditionTitle(v: V): string {
  const level = expeditionLevel(v.R.research);
  if (level < 1) return '';
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && staysAt(f.mission),
  ).length;
  return ` · Expeditionen (${used} / ${expeditionSlots(level, extraSlots(v.s.cfg))})`;
}

function fleet(v: V): string {
  const slots = fleetSlots(v.R);
  // The gift of the „Endzeit“ (#161) and missiles (#54) take no slot.
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && isFleet(f),
  ).length;
  const rows = shipRows(v);
  const head = box(
    `Flotten unterwegs (${used} / ${slots} Slots)${expeditionTitle(v)}`,
    fleetTable(v),
  );
  if (!rows)
    return `<h2>Flotte</h2>${head}${unionBox(v)}<div class="notice">Auf diesem Planeten stehen keine Schiffe. Baue welche in der Schiffsschmiede.</div>${jumpBox(v)}`;
  const pick = `<table><tr><th>Schiff</th><th class="n">vorhanden</th><th class="n">Tempo</th><th>Anzahl</th></tr>${rows}</table>
  <div class="mt"><span class="lnk" data-act="fall">alle Schiffe</span> · <span class="lnk" data-act="fnone">keine Schiffe</span></div>`;
  return `<h2>Flotte</h2>${head}${unionBox(v)}${box('1. Schiffe auswählen', pick)}${box('2. Ziel und Auftrag', targetForm(v, used >= slots))}${jumpBox(v)}`;
}

// ----- the comparison -----

/** u1 is the player; u5 is unknown to the list of players. */
const OWNERS = ['u1', 'u2', 'u3', 'u5'] as const;

const time = fc.integer({ min: 0, max: 2_000_000 });
/** A small part of the universe, so the target meets the places; 16 is the expedition position (#93). */
const coord = fc.record({
  g: fc.integer({ min: 1, max: 2 }),
  s: fc.integer({ min: 1, max: 2 }),
  p: fc.constantFrom(1, 2, 3, 4, 16),
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
  state: fc.constantFrom('out' as const, 'back' as const, 'hold' as const),
  arr: time,
  ret: fc.option(time, { nil: undefined }),
  ships: fc.option(levels(Object.keys(SHIPS), 3000), { nil: undefined }),
  gift: fc.option(fc.constant(true as const), { nil: undefined }),
  union: fc.option(fc.constantFrom('f0', 'f1'), { nil: undefined }),
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
        name: 'Ort <i>&"\'</i>',
        temp: 20,
      }),
    ),
  );

const unionState = fc.record({
  id: fc.constantFrom('f0', 'f1', 'un<1>'),
  leader: fc.constantFrom(...OWNERS),
  toC: coord,
  arr: time,
  fleets: fc.array(
    fc.record({
      id: fc.constantFrom('f0', 'f1', 'f2'),
      owner: fc.constantFrom(...OWNERS),
    }),
    { minLength: 1, maxLength: 3 },
  ),
  invited: fc.array(fc.constantFrom(...OWNERS), { maxLength: 2 }),
});

const generated = fc.record({
  at: coord,
  moon: fc.record({ on: fc.boolean(), gate: fc.integer({ min: 0, max: 3 }) }),
  // Mostly some ships, sometimes none or only ones that cannot fly.
  ships: fc.oneof(
    levels(Object.keys(SHIPS), 2_000_000),
    fc.constant({} as Levels),
    fc.constant({ sat: 4 } as Levels),
  ),
  research: levels(Object.keys(RES), 12),
  fleets: fc.array(flight, { maxLength: 6 }),
  galaxy: fc.uniqueArray(places, { maxLength: 8, selector: (p) => p[0]!.id }),
  gates: fc.array(
    fc.record({
      pick: fc.nat(),
      level: fc.integer({ min: 1, max: 3 }),
      ready: time,
    }),
    { maxLength: 3 },
  ),
  quick: fc.record({
    friends: fc.array(fc.nat(), { maxLength: 2 }),
    guild: fc.array(fc.nat(), { maxLength: 2 }),
    last: fc.array(fc.nat(), { maxLength: 2 }),
  }),
  unions: fc.array(unionState, { maxLength: 3 }),
  speed: fc.constantFrom(1, 4),
  target: fc.option(
    fc.record({
      at: coord,
      kind: fc.constantFrom('planet' as const, 'moon' as const, undefined),
    }),
  ),
  mission: fc.constantFrom(...Object.keys(MISSION), 'nope'),
  joined: fc.constantFrom('f0', 'un<1>', 'zz'),
  now: time,
});

type Generated = typeof generated extends fc.Arbitrary<infer T> ? T : never;

function toView(x: Generated): V {
  const galaxy = x.galaxy.flat();
  // The ids of the places the lists name, or one the galaxy does not know.
  const id = (n: number): string => galaxy[n % (galaxy.length || 1)]?.id ?? 'x';
  const s = {
    cfg: { ...U, speed: x.speed },
    me: { id: 'u1', research: x.research },
    round: { number: 1, ...roundDefaults() } as RoundRules,
    players: { u1: { name: 'Ich' }, u2: { name: 'Feind <b>' } },
    // Fleet ids are unique, as the server gives them.
    fleets: x.fleets.map((f, i) => ({
      ...f,
      id: `f${i}`,
      to: '',
      ships: f.ships as Levels,
    })) as unknown as ClientFleet[],
    galaxy,
    debris: [],
    locks: [],
    gates: x.gates.map((g) => ({
      id: id(g.pick),
      level: g.level,
      ready: g.ready,
    })),
    quick: {
      friends: x.quick.friends.map(id),
      guild: x.quick.guild.map(id),
      last: x.quick.last.map(id),
    },
    unions: x.unions.map((u) => ({ ...u, to: 'p1_1_1' })) as UnionState[],
  } as unknown as GameState;
  const ui = {
    ft: x.target && { ...x.target.at, kind: x.target.kind },
    fm: x.mission,
    union: x.joined,
  } as unknown as Ui;
  const kind = x.moon.on ? 'moon' : 'planet';
  return {
    s,
    P: planet({
      ...x.at,
      id: placeId({ ...x.at, kind }),
      kind,
      ships: x.ships,
      b: { jumpgate: x.moon.gate },
    }),
    R: { research: x.research, rq: null },
    now: x.now,
    ui,
  };
}

const state = generated.map(toView);

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
  'Kein Auftrag passt zum Ziel',
  'data-act="send" data-full="" disabled',
  'Alle Flottenslots belegt',
  ' · Expeditionen (',
  'id="t_stay_row"',
  '<tr hidden id="t_hold">',
  '<tr id="t_hold">',
  '<select disabled id="t_q">',
  'Freund: ',
  'Gilde: ',
  'Ziel: ',
  'id="t_union_row"',
  '<option selected value="f0">',
  'Verbandsangriff</div>',
  'data-act="inviteUnion"',
  'data-act="joinUnion"',
  'data-act="openUnion"',
  'Ruft der Anführer',
  'Eingeladen: ',
  'Warp-Tor</div>',
  'data-act="jump" disabled',
  'data-act="jump">',
  'Wieder bereit in',
  '<select class="jump-to" disabled id="jg_to">',
  '<option disabled value="',
  'Planeten: ',
];

const SAMPLE = { seed: 118, numRuns: 300 };

/** A view of the player's planet at 1:1:5 with ships, the target and the mission chosen. */
function handBuilt(over: {
  debris?: GameState['debris'];
  fleets?: ClientFleet[];
  ft?: Ui['ft'];
  fm?: string;
}): V {
  const s = {
    cfg: U,
    me: { id: 'u1', research: {} },
    round: { number: 1, ...roundDefaults() } as RoundRules,
    players: { u1: { name: 'Ich' } },
    fleets: over.fleets ?? [],
    galaxy: [],
    debris: over.debris ?? [],
  } as unknown as GameState;
  return {
    s,
    P: planet({ ships: { lc: 5, rec: 2 } }),
    R: { research: {}, rq: null },
    now: 10_000,
    ui: { ft: over.ft ?? null, fm: over.fm ?? 'attack' } as unknown as Ui,
  };
}

/** An own Sturmangriff on its way that can open an attack union (#225). */
const attackOut = {
  id: 'f0',
  owner: 'u1',
  fromC: { g: 1, s: 1, p: 5 },
  toC: { g: 1, s: 1, p: 3 },
  to: 'p1_1_3',
  mission: 'attack',
  state: 'out',
  arr: 100_000,
  ret: 200_000,
  ships: { lc: 1 },
} as ClientFleet;

/**
 * The cases the sample reaches rarely or not at all, built by hand: it
 * reaches them in a few of 300 runs, and every new mission or catalog entry
 * moves the sample (see the log of #118, bundle 2).
 */
const HAND_BUILT: [string, V][] = [
  [
    'a Bergung on a position with a Trümmerfeld',
    handBuilt({
      debris: [{ id: 'd1_1_3', g: 1, s: 1, p: 3, m: 1500, c: 20 }],
      ft: { g: 1, s: 1, p: 3 },
      fm: 'harvest',
    }),
  ],
  [
    'an own Sturmangriff that can open a union',
    handBuilt({ fleets: [attackOut] }),
  ],
  [
    'a mission that does not hold',
    handBuilt({ ft: { g: 1, s: 1, p: 6 }, fm: 'colonize' }),
  ],
];

describe('Fleet against the view before #118, bundle 3', () => {
  it('renders the fleet view as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(fleetView(v))).toBe(normalize(fleet(v)));
      }),
      SAMPLE,
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      expect(normalize(fleetView(v)), name).toBe(normalize(fleet(v)));
  });

  // The sample reaches these by chance only and every new mission moves it.
  it('reaches the rare branches by the hand-built cases alone', () => {
    const rare = [
      '<option selected value="harvest">',
      'data-act="openUnion"',
      '<tr hidden id="t_hold">',
    ];
    const html = HAND_BUILT.map(([, v]) => normalize(fleetView(v))).join('');
    expect(rare.filter((mark) => html.includes(mark))).toEqual(rare);
  });

  it('reaches every branch', () => {
    const seen = new Set<string>();
    const collect = (v: V): void => {
      const html = normalize(fleetView(v));
      for (const mark of MARKS) if (html.includes(mark)) seen.add(mark);
    };
    fc.assert(fc.property(state, collect), SAMPLE);
    for (const [, v] of HAND_BUILT) collect(v);
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
