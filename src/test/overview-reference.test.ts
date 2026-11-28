// Overview renders the overview as it was before #118 („no visible change“
// of the issue; each migration step changes no behaviour, owner,
// 2026-11-13), and the fleet view keeps its list of fleets. The old view is
// frozen here: overview() and fleetTable() of src/client/views/overview.ts.
// On generated states (fixed fast-check seed 118) both render the same
// markup, up to what a browser does not show (normalize() of markup.ts, the
// same as for the lists).
import fc from 'fast-check';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from '../core/catalog.ts';
import { fleetSlots } from '../core/flight.ts';
import { FLEET_MISSIONS, MISSION } from '../core/missions.ts';
import { placeName } from '../core/moon.ts';
import { text } from '../core/text.ts';
import type { Levels, Planet, ResearchState } from '../core/types.ts';
import { planetsLine } from '../client/logic/colony-limit.ts';
import { diameterLine } from '../client/logic/fields.ts';
import { coords, dt, esc, fmt } from '../client/logic/format.ts';
import { fleetEnd, nameOf, ranks, sortFleets } from '../client/logic/game.ts';
import { planetLook } from '../client/logic/planet.ts';
import { client } from '../client/logic/state.svelte.ts';
import type { ClientFleet, GameState } from '../client/logic/types.ts';
import { box, cd, type Ui, type V } from '../client/views/common.ts';
import Overview from '../client/views/Overview.svelte';
import OverviewCards from '../client/views/OverviewCards.svelte';
import { planet, roundDefaults, U } from './fixtures.ts';
import { fleetView } from './fleet-view.ts';
import { planetHTML } from './html-pieces-frozen.ts';
import { normalize } from './markup.ts';

// ----- frozen: src/client/views/overview.ts before #118 -----

const shipList = (f: ClientFleet): string =>
  Object.entries(f.ships ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${fmt(n)} ${text(k)?.n ?? k}`)
    .join(', ');

function fleetText(v: V, f: ClientFleet): string {
  const ships = shipList(f);
  const mission = MISSION[f.mission];
  if (f.owner !== v.s.me.id)
    return `Eine fremde Flotte von <b>${esc(nameOf(v.s.players, f.owner))}</b> ${coords(f.fromC)} erreicht deinen Planeten ${coords(f.toC)} · ${mission}${ships ? ` (${ships})` : ''}`;
  // The gift of the „Endzeit“ comes from „Gottkaiser“ (#161).
  const origin = f.gift ? 'Gottkaiser' : coords(f.fromC);
  if (f.state === 'out')
    return `Deine Flotte (${ships}) von ${origin} erreicht ${coords(f.toC)} · ${mission}`;
  return `Deine Flotte (${ships}) kehrt von ${coords(f.toC)} nach ${coords(f.fromC)} zurück`;
}

function fleetRow(v: V, f: ClientFleet): string {
  const mine = f.owner === v.s.me.id;
  const out = f.state === 'out';
  const cls = out ? `fl-${f.mission}` : 'fl-back';
  const button =
    mine && out && !f.gift
      ? `<button class="small" data-act="recall" data-id="${esc(f.id)}">Rückruf</button>`
      : '';
  return `<tr><td class="n w110">${cd(fleetEnd(f), v.now)}</td><td class="${cls}">${fleetText(v, f)}</td><td class="w80">${button}</td></tr>`;
}

function fleetTable(v: V, includeIncoming: boolean): string {
  const list = sortFleets(
    v.s.fleets.filter((f) => f.owner === v.s.me.id || includeIncoming),
  );
  return list.length
    ? `<table>${list.map((f) => fleetRow(v, f)).join('')}</table>`
    : '<span class="dim">Keine Flottenbewegungen.</span>';
}

function activities(v: V): string {
  const { P, R, now } = v;
  const rows: string[] = [];
  if (P.bq)
    rows.push(
      `<tr><td>Gebäude</td><td>${text(P.bq.key)?.n} (Stufe ${P.bq.lvl})</td><td class="n">${cd(P.bq.end, now)}</td></tr>`,
    );
  if (R.rq)
    rows.push(
      `<tr><td>Forschung</td><td>${text(R.rq.key)?.n} (Stufe ${R.rq.lvl})</td><td class="n">${cd(R.rq.end, now)}</td></tr>`,
    );
  if (P.sq.length) {
    const list = P.sq.map((q) => `${fmt(q.n)}× ${text(q.key)?.n}`).join(', ');
    rows.push(
      `<tr><td>Schiffsschmiede</td><td>${list}</td><td class="n">${cd((P.sqT ?? now) + P.sq[0]!.unit, now)} (nächste)</td></tr>`,
    );
  }
  return rows.length
    ? `<table>${rows.join('')}</table>`
    : '<span class="dim">Nichts in Arbeit – deine Minen langweilen sich.</span>';
}

/** frozen: moonPicture() of src/client/logic/moon.ts, the name in `alt`. */
const moonPicture = (name: string, size: number): string =>
  `<img class="moon" src="/icons/moon.svg" alt="${esc(name)}" width="${size}" height="${size}">`;

/** The picture and the kind of the shown place: a planet or a moon (#53). */
const look = (P: V['P']): { picture: string; label: string; type: string } =>
  P.kind === 'moon'
    ? {
        picture: `<span class="moon-big">${moonPicture(placeName(P), 120)}</span>`,
        label: 'Mond',
        type: 'Mond',
      }
    : { picture: planetHTML(P), label: 'Planet', type: planetLook(P).name };

/** „Kolonie aufgeben“ (#224): an own planet that is not the main planet. */
const giveUp = ({ P, s }: V): string =>
  P.kind === 'planet' && P.owner === s.me.id && P.id !== s.mainPlanet
    ? '<p><button class="small red" data-act="abandon">Kolonie aufgeben</button></p>'
    : '';

function overview(v: V): string {
  const { P, s } = v;
  const me = s.me.id;
  const rk = ranks(s.players);
  const l = look(P);
  return `<h2>Übersicht – ${esc(placeName(P))} ${coords(P)}</h2>
 ${box('Flottenbewegungen', fleetTable(v, true))}
 <div class="box"><div class="bd ov">${l.picture}
 <table class="kv kv-grow">
 <tr><td>${l.label}</td><td>${esc(placeName(P))} <span class="lnk" data-act="rename">(umbenennen)</span></td></tr>
 <tr><td>Position</td><td>${coords(P)}</td></tr><tr><td>Planetentyp</td><td>${l.type}</td></tr><tr><td>Temperatur</td><td>ca. ${P.temp - 40}°C bis ${P.temp}°C</td></tr>
 <tr><td>Durchmesser</td><td>${diameterLine(P, s.cfg)}</td></tr>
 <tr><td>Punkte</td><td>${fmt(s.players[me]?.points)} (Platz ${rk[me] ?? '-'} von ${Object.keys(s.players).length})</td></tr>
 <tr><td>Planetengrenze</td><td>${planetsLine(s)}</td></tr>
 <tr><td>Serverzeit</td><td>${dt(v.now)}</td></tr></table>${giveUp(v)}</div></div>
 ${box('Aktivitäten', activities(v))}`;
}

// ----- the comparison -----

function renderOnce(v: V): string {
  client.shown = v;
  try {
    return render(Overview).body;
  } finally {
    client.shown = null;
  }
}

/**
 * The new overview of a state, rendered once: the comparison and the check of
 * the marks show the same states, and rendering is what takes the time. A
 * state is never changed by a rendering.
 */
const rendered = new WeakMap<V, string>();
function renderNew(v: V): string {
  const html = rendered.get(v) ?? renderOnce(v);
  rendered.set(v, html);
  return html;
}

// One change on purpose (#189, D5, the phone layer; the CSS shows it up to
// 760 px only): the cards „Läuft“, „Achtung“ and „Bereit“ right after the
// title. The frozen view gets them from the component itself; what they
// show is tested in src/client/logic/overview-cards.test.ts and
// src/client/views/overview-cards.test.ts.
function withCards(old: string, v: V): string {
  client.shown = v;
  try {
    return old.replace(
      '</h2>',
      `</h2>${render(OverviewCards, { props: { v } }).body}`,
    );
  } finally {
    client.shown = null;
  }
}

/** The head of the fleet view before #118, with the frozen list of fleets. */
function fleetHead(v: V): string {
  const slots = fleetSlots(v.R);
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && !f.gift,
  ).length;
  return `<h2>Flotte</h2>${box(`Flotten unterwegs (${used} / ${slots} Slots)`, fleetTable(v, false))}`;
}

const levels = (keys: string[], max: number): fc.Arbitrary<Levels> =>
  fc.record(
    Object.fromEntries(keys.map((k) => [k, fc.integer({ min: 0, max })])),
    { requiredKeys: [] },
  ) as fc.Arbitrary<Levels>;

/**
 * The last name becomes an attribute boundary in `alt` when its quotes are
 * not escaped (CodeRabbit on #210).
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

const time = fc.integer({ min: 0, max: 2_000_000 });
const coord = fc.record({
  g: fc.integer({ min: 1, max: 9 }),
  s: fc.integer({ min: 1, max: 499 }),
  p: fc.integer({ min: 1, max: 15 }),
});

const buildOrder: fc.Arbitrary<Planet['bq']> = fc.option(
  fc.record({
    key: fc.constantFrom(...Object.keys(BUILD)),
    lvl: fc.integer({ min: 1, max: 30 }),
    start: time,
    end: time,
    cost: fc.constant([0, 0, 0] as [number, number, number]),
  }),
);

const unitOrder: fc.Arbitrary<Planet['sq'][number]> = fc.record({
  key: fc.constantFrom(...Object.keys(SHIPS), ...Object.keys(DEF)),
  n: fc.integer({ min: 1, max: 5000 }),
  unit: fc.integer({ min: 1, max: 600_000 }),
});

const place = fc
  .record({
    kind: fc.constantFrom('planet' as const, 'moon' as const),
    name: fc.constantFrom(...NAMES),
    at: coord,
    temp: fc.integer({ min: -140, max: 160 }),
    diameter: fc.integer({ min: 1000, max: 16000 }),
    unlimited: fc.boolean(),
    b: levels(Object.keys(BUILD), 14),
    bq: buildOrder,
    sq: fc.array(unitOrder, { maxLength: 3 }),
    sqT: fc.option(time),
  })
  .map(({ at, ...p }) => planet({ ...p, ...at }));

const flight = fc.record({
  owner: fc.constantFrom(...OWNERS),
  fromC: coord,
  toC: coord,
  // The missions of the view before #54: missiles came later, without a recall.
  mission: fc.constantFrom(...FLEET_MISSIONS),
  state: fc.constantFrom('out' as const, 'back' as const),
  arr: time,
  ret: fc.option(time, { nil: undefined }),
  ships: fc.option(levels(Object.keys(SHIPS), 3000), { nil: undefined }),
  gift: fc.option(fc.constant(true as const), { nil: undefined }),
});

type Flight = typeof flight extends fc.Arbitrary<infer T> ? T : never;

/** What a state of the overview is made of, by the generator and by hand. */
interface Parts {
  P: Planet;
  research: Levels;
  rq: ResearchState['rq'];
  fleets: Flight[];
  players: Record<string, { name: string; points: number }>;
  extraFields: number;
  now: number;
}

function view(x: Parts): V {
  const s = {
    cfg: { ...U, extraFields: x.extraFields },
    me: { id: 'u1', readAt: 0 },
    // The cards of the phone (#189) read the messages.
    reports: [],
    // Fleet ids are unique, as the server gives them.
    // A foreign fleet always carries its ships here: one without them
    // shows „Zusammensetzung unbekannt“ (#228), which the frozen view did
    // not know (src/client/logic/overview.test.ts covers it).
    // A foreign Wache stellen on its way shows under „Gehaltene Flotten“
    // since #440, which the frozen view did not know either
    // (src/client/logic/overview.test.ts covers it): here it flies home.
    fleets: x.fleets.map((f, i) => ({
      ...f,
      ...(f.owner !== 'u1' && f.mission === 'hold' && { state: 'back' }),
      id: `f${i}`,
      to: '',
      ships: (f.owner === 'u1' ? f.ships : (f.ships ?? {})) as Levels,
    })),
    players: x.players,
    galaxy: [],
    // The shown planet is the main planet now and then (#224).
    mainPlanet: x.now % 3 === 0 ? x.P.id : null,
    // The round of every state: the box „Verbandsangriff“ of the fleet view
    // reads its switch since #466.
    round: { number: 1, ...roundDefaults() },
  } as unknown as GameState;
  return {
    s,
    P: x.P,
    R: { research: x.research, rq: x.rq },
    now: x.now,
    ui: { fm: 'attack', ft: null } as unknown as Ui,
  };
}

const state = fc
  .record({
    P: place,
    research: levels(Object.keys(RES), 13),
    rq: fc.option(
      fc.record({
        key: fc.constantFrom(...Object.keys(RES)),
        lvl: fc.integer({ min: 1, max: 14 }),
        start: time,
        end: time,
        cost: fc.constant([0, 0, 0] as [number, number, number]),
      }),
    ),
    fleets: fc.array(flight, { maxLength: 5 }),
    players: fc.dictionary(
      fc.constantFrom(...OWNERS.slice(0, 4)),
      fc.record({
        name: fc.constantFrom('Ich', 'Feind', 'Kain <i>&"\'</i>', 'Ödön'),
        points: fc.integer({ min: 0, max: 9_000_000 }),
      }),
    ),
    extraFields: fc.integer({ min: 0, max: 40 }),
    now: time,
  })
  .map((x): V => view(x));

/**
 * The sample (seed 118, 300 runs), generated once and used by every test that
 * needs it. The comparison takes it in slices of the one array.
 */
const SAMPLE_RUNS = 300;
const SLICE = 100;
let sample: V[] | undefined;
function SAMPLE(): V[] {
  if (!sample) {
    const states: V[] = [];
    fc.assert(
      fc.property(state, (v) => {
        states.push(v);
      }),
      { seed: 118, numRuns: SAMPLE_RUNS },
    );
    sample = states;
  }
  return sample;
}
const SLICES = Array.from({ length: SAMPLE_RUNS / SLICE }, (_, i) => i);

/** Normalized markup of every branch of the overview, for the check that the cases reach them. */
const MARKS = [
  'data-act="recall"',
  'Eine fremde Flotte von <b>',
  '<b>Unbekannt</b>',
  '<b>Kain &lt;i>&amp;"\'&lt;/i></b>',
  'von Gottkaiser erreicht',
  'kehrt von',
  'Deine Flotte () von',
  'class="cd"',
  'gleich …',
  'Keine Flottenbewegungen.',
  'Nichts in Arbeit',
  '<td>Gebäude</td>',
  '<td>Forschung</td>',
  ' (nächste)',
  'class="moon-big"',
  'class="pl pl-',
  'Felder, unbegrenzt',
  'Felder)',
  '(Platz - von',
  'Mond &lt;b>&amp;"\'&lt;/b> (Mond)',
  'alt="Nord&quot; b=&quot;Süd (Mond)"',
  'class="fl-back"',
  'data-act="abandon"',
  ...FLEET_MISSIONS.map((m) => `class="fl-${m}"`),
];

/** Adds the marks that `html` shows to `seen`. */
function collect(html: string, seen: Set<string>): void {
  for (const mark of MARKS) if (html.includes(mark)) seen.add(mark);
}

/** The branches the sample reached 10 times or not at all: each has a hand-built case below. */
const RARE = [
  'Nichts in Arbeit',
  'data-act="recall"',
  'Deine Flotte () von',
  'Mond &lt;b>&amp;"\'&lt;/b> (Mond)',
  'alt="Nord&quot; b=&quot;Süd (Mond)"',
];

/** A state by hand: a planet, nothing running, no fleet, no other player. */
function handBuilt(over: Partial<Planet>, more: Partial<Parts> = {}): V {
  return view({
    P: planet(over),
    research: {},
    rq: null,
    fleets: [],
    players: {},
    extraFields: 0,
    now: 1000,
    ...more,
  });
}

const ownFleet: Flight = {
  owner: 'u1',
  fromC: { g: 1, s: 1, p: 5 },
  toC: { g: 1, s: 2, p: 3 },
  mission: 'attack',
  state: 'out',
  arr: 5000,
  ret: undefined,
  ships: undefined,
  gift: undefined,
};

/** Cases that make the rare branches certain, each named by what it shows. */
const HAND_BUILT: readonly (readonly [string, V])[] = [
  ['nothing running', handBuilt({})],
  // An own fleet on its way out: the recall button, and no ships to name.
  ['an own fleet without ships', handBuilt({}, { fleets: [ownFleet] })],
  [
    'a moon named with markup',
    handBuilt({ kind: 'moon', name: 'Mond <b>&"\'</b>' }),
  ],
  [
    'a moon named with quotes',
    handBuilt({ kind: 'moon', name: 'Nord" b="Süd' }),
  ],
];

describe('Overview against the view before #118', () => {
  it('compares the whole sample, in slices of it', () => {
    expect(SAMPLE()).toHaveLength(SLICES.length * SLICE);
    expect(
      SLICES.flatMap((i) => SAMPLE().slice(i * SLICE, (i + 1) * SLICE)),
    ).toEqual(SAMPLE());
  });

  it.each(SLICES)('renders the overview as before, slice %i', (i) => {
    SAMPLE()
      .slice(i * SLICE, (i + 1) * SLICE)
      .forEach((v, j) => {
        expect(normalize(renderNew(v)), `run ${i * SLICE + j}`).toBe(
          normalize(withCards(overview(v), v)),
        );
      });
  });

  it('keeps the list of fleets of the fleet view', () => {
    SAMPLE().forEach((v, i) => {
      // The title counts the expeditions once the research is there (#93,
      // tested in src/client/views/fleet.test.ts): without it, as before.
      const old = {
        ...v,
        R: { ...v.R, research: { ...v.R.research, expo: 0 } },
      };
      expect(
        normalize(fleetView(old)).startsWith(normalize(fleetHead(v))),
        `run ${i}`,
      ).toBe(true);
    });
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      expect(normalize(renderNew(v)), name).toBe(
        normalize(withCards(overview(v), v)),
      );
  });

  // The generated states reach the rare branches by chance only: the sample
  // (seed 118, 300 runs) reached „Nichts in Arbeit“ not at all once the
  // catalog had 58 entries, and the recall button and the fleet without
  // ships 10 times. A new catalog entry moves the sample, so these branches
  // are also reached by hand-built cases, on purpose and always.
  it('reaches the rare branches by the hand-built cases alone', () => {
    const seen = new Set<string>();
    for (const [, v] of HAND_BUILT) collect(normalize(renderNew(v)), seen);
    expect([...seen].filter((m) => RARE.includes(m)).sort()).toEqual(
      [...RARE].sort(),
    );
  });

  it('reaches every branch', () => {
    // The sample (seed 118) and the hand-built cases together.
    const seen = new Set<string>();
    for (const [, v] of HAND_BUILT) collect(normalize(renderNew(v)), seen);
    for (const v of SAMPLE()) collect(normalize(renderNew(v)), seen);
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
