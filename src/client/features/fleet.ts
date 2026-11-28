// The fleet form and what belongs to it (#45, #53, #230, #240): the ship
// selection, the cargo, the preview of distance, time and fuel, „Abschicken“,
// „Zurückrufen“, and „Springen“ of the Warp-Tor. The markup is in
// views/fleet.ts, the box of the Warp-Tor from logic/jump-gate.ts, the
// shortcuts to the form are in features/galaxy.ts. The ships, the position,
// the speed, the cargo, the kind of target and the mission are the state of
// logic/fleet-form.svelte.ts (#332), which the form binds; the handlers read
// and write it, and logic/fleet-choice.ts works out what the form shows.
import { settle } from '../../core/settle.ts';
import type { Planet, Resources } from '../../core/types.ts';
import { $, setField } from '../dom.ts';
import { clampInt, dur, fmt } from '../logic/format.ts';
import {
  arrivalLine,
  CARGO,
  cargoMax,
  cargoPreview,
  cargoOne,
  type FleetForm,
  fleetPreview,
} from '../logic/game.ts';
import { SPEEDS } from '../logic/fleet.ts';
import { type FleetChoice, fleetChoice } from '../logic/fleet-choice.ts';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { targetInfo } from '../logic/fleet-target.ts';
import { client } from '../logic/state.svelte.ts';
import {
  PLAN,
  freeShips,
  planJoin,
  type UnionJoin,
  unionArrivalLine,
  unionJoin,
} from '../logic/union.ts';
import { distance, fleetSpeed } from '../../core/flight.ts';
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';
import { askOne } from '../../core/cargo-fill.ts';

/** The shown planet with its stock of this moment, for the cargo buttons. */
const settledPlanet = (): Planet =>
  settle(client.game!.planet!, client.now(), client.game!.cfg, client.game!.me);

/** What the fields of the form show (logic/fleet-choice.ts), for the state of the game and the shown planet. */
const choiceOf = (): FleetChoice =>
  fleetChoice(
    {
      s: client.game!,
      P: client.view!.P,
      R: client.view!.R,
      ui: client.view!.ui,
    },
    fleetForm,
    client.now(),
  );

/** The ships typed, kept to the ones the planet has. */
function shipsOf(): Record<string, number> {
  const ships: Record<string, number> = {};
  const have = freeShips(client.game!, client.view!.P);
  for (const [k, typed] of Object.entries(fleetForm.ships)) {
    const n = clampInt(typed, 0, have[k] ?? 0);
    if (n > 0) ships[k] = n;
  }
  return ships;
}

/** The cargo typed, per resource. */
const cargoOf = (): FleetForm['cargo'] => ({
  m: clampInt(fleetForm.cargo.m ?? '', 0, 1e15),
  c: clampInt(fleetForm.cargo.c ?? '', 0, 1e15),
  d: clampInt(fleetForm.cargo.d ?? '', 0, 1e15),
});

/**
 * The union the fleet joins (#225), or the arrival of one it plans (#466):
 * the time of the field, 0 while it is empty, which the server refuses.
 */
function unionFields(
  union: string,
  plan: string,
): Pick<FleetForm, 'union' | 'plan'> {
  if (union !== PLAN) return union ? { union } : {};
  const arr = new Date(plan).getTime();
  return { plan: Number.isNaN(arr) ? 0 : arr };
}

function readFleetForm(): FleetForm {
  const { to, kind, mission, union, plan, stays, hold, stay } = choiceOf();
  return {
    ships: shipsOf(),
    // The planet or its moon (#53).
    to: { ...to, kind },
    mission,
    ...unionFields(union, plan),
    // The row of the time at the target holds one of the two: the stay of an expedition (#93) or the holding time (#55).
    hold: stays ? 0 : Number(hold),
    stay: stays ? clampInt(stay, 1, 1e6) : 1,
    pct: clampInt(fleetForm.speed ?? SPEEDS[0]!.value, 1, 10),
    cargo: cargoOf(),
    // The fields the „alles“ buttons filled: the server computes them on its
    // stock at the launch (#407).
    ...(fleetForm.cargoAll && { cargoAll: fleetForm.cargoAll }),
  };
}

/**
 * „Mond“ only where a moon is (#53), and the choice of the player kept: a
 * kind the place cannot have goes back to the planet (and stays there when
 * the target changes to a place with a moon again); the kind chosen is also
 * remembered in `client.ui.fk` for the next fleet form of a fresh render.
 */
function settleKind(): void {
  const { moon, kind } = choiceOf();
  if (!moon) client.ui.fk = 'planet';
  else if (kind === 'moon') client.ui.fk = 'moon';
  fleetForm.kind = kind;
}

/**
 * Keeps the kind of target the player chose in `client.ui.fk`: a fresh
 * render forgets the state of the form, and the next form starts with it
 * (`fleetChoice`).
 */
function rememberKind(field: { id?: string; value?: string } | null): void {
  if (field?.id === 't_k')
    client.ui.fk = field.value === 'moon' ? 'moon' : 'planet';
}

/**
 * The list „Auftrag“ follows the target (#253): the component shows only the
 * missions that fit it (`fleetChoice`), the chosen one kept while it fits,
 * else the first; when none fits the list says so and „Flotte losschicken“ is
 * blocked. The mission it ends on is the state of the form again, and is also
 * kept in `client.ui.fm` for the next fleet form of a fresh render. A target
 * that no mission fits keeps the choice for when one fits again.
 */
function settleMission(): void {
  const { mission } = choiceOf();
  if (!mission) return;
  fleetForm.mission = mission;
  client.ui.fm = mission;
}

/**
 * The row of the time at the target follows the mission (#55, #93): the stay
 * of an expedition or the holding time of a Halten, and the row of the other
 * kind starts again with 1 hour when the mission changes to it.
 */
function settleTime(): void {
  if (choiceOf().stays) fleetForm.hold = null;
  else fleetForm.stay = null;
}

/**
 * The fields of the „alles“ buttons follow the form (#407): other ships, a
 * farther target or a stock that grew change what the server will load, so
 * the preview shows it again.
 */
function showIntent(): void {
  const intent = fleetForm.cargoAll;
  if (!intent) return;
  const c = cargoPreview(settledPlanet(), readFleetForm());
  // Only the fields of the buttons; a field typed by hand stays as typed.
  for (const k of intent === 'even' ? CARGO : intent)
    fleetForm.cargo[k] = String(c[k]);
}

/**
 * How the fleet of the form joins its attack union: at the speed that
 * brings it there at the union's arrival (#466); null for a fleet of no
 * union.
 */
function formJoin(f: FleetForm): UnionJoin | null {
  const { game, view } = client;
  if ((!f.union && f.plan === undefined) || !game || !view) return null;
  const fleet = {
    dist: distance(view.P, f.to),
    speed: fleetSpeed(f.ships, view.R),
    pct: f.pct,
  };
  // A plan of 0 is a field still empty.
  if (f.plan !== undefined)
    return planJoin(game, f.plan || Number.NaN, client.now(), fleet);
  return unionJoin(game, f.union!, client.now(), fleet);
}

/** The speed and flight of a join the preview takes; none for a refused one. */
const flying = (
  join: UnionJoin | null,
): Extract<UnionJoin, { pct: number }> | undefined =>
  join && 'pct' in join ? join : undefined;

function fleetCalc(): void {
  if (!$('#t_g') || !client.view || !client.game) return;
  settleKind();
  settleMission();
  settleTime();
  showIntent();
  const f = readFleetForm();
  $('#t_info')!.innerHTML = targetInfo(client.game, f);
  const join = formJoin(f);
  const pv = fleetPreview(
    client.view.P,
    client.view.R,
    f,
    client.game.cfg,
    flying(join),
  );
  const set = (id: string, html: string): void =>
    void ($(`#${id}`)!.innerHTML = html);
  if (!pv)
    return ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].forEach((id) =>
      set(id, '-'),
    );
  const now = client.now();
  set('i_dist', fmt(pv.dist));
  set('i_dur', dur(pv.ms));
  set('i_arr', join ? unionArrivalLine(join) : arrivalLine(f.mission, now, pv));
  set(
    'i_fuel',
    `<span class="${pv.fuelShort ? 'bad' : ''}">${fmt(pv.fuel)}</span> Promethium`,
  );
  set(
    'i_cap',
    `<span class="${pv.overload ? 'bad' : ''}">${fmt(pv.load)}</span> / ${fmt(pv.cap)}`,
  );
}

/** The keys of the ships the form lists. */
const shipKeys = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('.fs'),
    (i) => i.dataset.k!,
  );

/** All of the ship `k` on the shown planet, as the field shows it. */
const allOf = (k: string): string =>
  String(freeShips(client.game!, client.view!.P)[k] ?? 0);

/** The ship selection: all, none, the most of one kind. */
const selectionActs = (): Record<string, Handler> => ({
  fall: () => {
    for (const k of shipKeys()) fleetForm.ships[k] = allOf(k);
    fleetCalc();
  },
  fnone: () => {
    for (const k of shipKeys()) fleetForm.ships[k] = '';
    fleetCalc();
  },
  fmax: (d) => {
    fleetForm.ships[d.k!] = allOf(d.k!);
    fleetCalc();
  },
});

/** The cargo: all of it evenly, all of one resource. */
const cargoActs = (): Record<string, Handler> => ({
  cmax: () => {
    const c = cargoMax(settledPlanet(), readFleetForm());
    for (const k of CARGO) fleetForm.cargo[k] = String(c[k]);
    fleetForm.cargoAll = 'even';
    fleetCalc();
  },
  cone: (d) => {
    const k = d.k as keyof Resources;
    fleetForm.cargo[k] = String(cargoOne(settledPlanet(), readFleetForm(), k));
    // Only this field stays computed; an earlier „alles“ keeps its number (159b).
    fleetForm.cargoAll = askOne(k);
    fleetCalc();
  },
});

/** Sending, recalling and jumping. */
const flightActs = ({
  act,
  actHere,
  render,
}: ClientCtx): Record<string, Handler> => ({
  send: async () => {
    const form = readFleetForm();
    // No mission fits the target: the list is empty and sending is blocked (#253).
    if (!form.mission) return;
    if (await actHere('send', form)) {
      client.ui.ft = null;
      client.ui.fk = undefined;
      client.ui.union = null;
      render(true);
    }
  },
  recall: (d) => act('recall', { id: d.id }),
  jump: async () => {
    const to = document.querySelector<HTMLSelectElement>('#jg_to')?.value;
    if (await actHere('jump', { to, ships: readFleetForm().ships }))
      render(true);
  },
});

/**
 * The list „Schnellwahl“ (#253): the place chosen is entered as the target,
 * planet or moon, and the list goes back to „– wählen –“. The mission list
 * follows in `fleetCalc`.
 */
function quickChoice(ctx: ClientCtx, field: HTMLSelectElement): void {
  const place = client.game?.galaxy.find((p) => p.id === field.value);
  setField(field, '');
  if (!place) return;
  fleetForm.to = { g: String(place.g), s: String(place.s), p: String(place.p) };
  fleetForm.kind = place.kind;
  client.ui.fk = place.kind;
}

/** The data-act handlers of the fleet; the form is calculated again on every input. */
export const clientFeature = {
  listen: (ctx) => {
    document.addEventListener('change', (e) => {
      if (client.ui.view !== 'fleet') return;
      const field = (e?.target ?? null) as HTMLSelectElement | null;
      rememberKind(field);
      if (field?.id === 't_q') quickChoice(ctx, field);
      fleetCalc();
    });
    document.addEventListener('input', (e) => {
      rememberKind(e.target as HTMLSelectElement | null);
      if (
        client.ui.view === 'fleet' &&
        (e.target as HTMLElement).closest('main')
      )
        fleetCalc();
    });
  },
  acts: (ctx) => ({
    ...selectionActs(),
    ...cargoActs(),
    ...flightActs(ctx),
  }),
  afterRender: () => {
    if (client.ui.view === 'fleet') fleetCalc();
  },
} satisfies ClientFeature;
