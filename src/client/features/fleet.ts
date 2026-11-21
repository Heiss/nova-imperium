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
import { $, val } from '../dom.ts';
import { writeField } from '../field-drafts.ts';
import { clampInt, dur, fmt } from '../logic/format.ts';
import {
  arrivalLine,
  CARGO,
  cargoMax,
  cargoOne,
  type FleetForm,
  fleetPreview,
} from '../logic/game.ts';
import { SPEEDS } from '../logic/fleet.ts';
import { type FleetChoice, fleetChoice } from '../logic/fleet-choice.ts';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { targetInfo } from '../logic/fleet-target.ts';
import { timeRow } from '../logic/fleet-time.ts';
import { client } from '../logic/state.svelte.ts';
import { unionArrivalLine } from '../logic/union.ts';
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';

/** The shown planet with its stock of this moment, for the cargo buttons. */
const settledPlanet = (): Planet =>
  settle(client.game!.planet!, client.now(), client.game!.cfg, client.game!.me);

/** What the fields of the form show (logic/fleet-choice.ts), for the state of the game and the shown planet. */
const choiceOf = (): FleetChoice =>
  fleetChoice(
    { s: client.game!, P: client.view!.P, ui: client.view!.ui },
    fleetForm,
    client.now(),
  );

function readFleetForm(): FleetForm {
  const ships: Record<string, number> = {};
  const P = client.view!.P;
  for (const [k, typed] of Object.entries(fleetForm.ships)) {
    const n = clampInt(typed, 0, P.ships[k] ?? 0);
    if (n > 0) ships[k] = n;
  }
  const { to, kind, mission, union } = choiceOf();
  return {
    ships,
    // The planet or its moon (#53).
    to: { ...to, kind },
    mission,
    // The attack union the fleet joins (#225); the row is there only while one concerns the player.
    ...(union && { union }),
    hold: Number(val('#t_h')),
    stay: clampInt(val('#t_stay'), 1, 1e6),
    pct: clampInt(fleetForm.speed ?? SPEEDS[0]!.value, 1, 10),
    cargo: {
      m: clampInt(fleetForm.cargo.m ?? '', 0, 1e15),
      c: clampInt(fleetForm.cargo.c ?? '', 0, 1e15),
      d: clampInt(fleetForm.cargo.d ?? '', 0, 1e15),
    },
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

function fleetCalc(): void {
  if (!$('#t_g') || !client.view || !client.game) return;
  settleKind();
  settleMission();
  timeRow(choiceOf().mission, client.view);
  const f = readFleetForm();
  $('#t_info')!.innerHTML = targetInfo(client.game, f);
  const pv = fleetPreview(client.view.P, client.view.R, f, client.game.cfg);
  const set = (id: string, html: string): void =>
    void ($(`#${id}`)!.innerHTML = html);
  if (!pv)
    return ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].forEach((id) =>
      set(id, '-'),
    );
  const now = client.now();
  set('i_dist', fmt(pv.dist));
  set('i_dur', dur(pv.ms));
  set(
    'i_arr',
    (f.union && unionArrivalLine(client.game, f.union, now, pv.ms)) ||
      arrivalLine(f.mission, now, pv),
  );
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
const allOf = (k: string): string => String(client.view!.P.ships[k] ?? 0);

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
    fleetCalc();
  },
  cone: (d) => {
    const k = d.k as keyof Resources;
    fleetForm.cargo[k] = String(cargoOne(settledPlanet(), readFleetForm(), k));
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
  writeField(field, '');
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
