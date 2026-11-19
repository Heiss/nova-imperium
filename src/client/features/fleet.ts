// The fleet form and what belongs to it (#45, #53, #230, #240): the ship
// selection, the cargo, the preview of distance, time and fuel, „Abschicken“,
// „Zurückrufen“, and „Springen“ of the Warp-Tor. The markup is in
// views/fleet.ts, the box of the Warp-Tor from logic/jump-gate.ts, the
// shortcuts to the form are in features/galaxy.ts.
import { settle } from '../../core/settle.ts';
import type { Planet, Resources } from '../../core/types.ts';
import { $, val } from '../dom.ts';
import { clampInt, dur, fmt } from '../logic/format.ts';
import {
  arrivalLine,
  CARGO,
  cargoMax,
  cargoOne,
  type FleetForm,
  fleetPreview,
} from '../logic/game.ts';
import { colonyNote } from '../logic/colony-limit.ts';
import {
  maxPosition,
  missionOptions,
  offeredMissions,
  targetInfo,
} from '../logic/fleet-target.ts';
import { timeRow } from '../logic/fleet-time.ts';
import { moonAt } from '../logic/moon.ts';
import { client } from '../logic/state.svelte.ts';
import { unionArrivalLine } from '../logic/union.ts';
import type { GameState } from '../logic/types.ts';
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';

/** The shown planet with its stock of this moment, for the cargo buttons. */
const settledPlanet = (): Planet =>
  settle(client.game!.planet!, client.now(), client.game!.cfg, client.game!.me);

function readFleetForm(): FleetForm {
  const ships: Record<string, number> = {};
  const P = client.view!.P;
  const u = client.game!.cfg;
  document.querySelectorAll<HTMLInputElement>('.fs').forEach((i) => {
    const k = i.dataset.k!;
    const n = clampInt(i.value, 0, P.ships[k] ?? 0);
    if (n > 0) ships[k] = n;
  });
  return {
    ships,
    to: {
      g: clampInt(val('#t_g'), 1, u.galaxies),
      s: clampInt(val('#t_s'), 1, u.systems),
      p: clampInt(val('#t_p'), 1, maxPosition(client.game!)),
      // The planet or its moon (#53).
      kind: val('#t_k') === 'moon' ? 'moon' : 'planet',
    },
    mission: val('#t_m'),
    // The attack union the fleet joins (#225); the row is there only while one concerns the player.
    ...(val('#t_u') && { union: val('#t_u') }),
    hold: Number(val('#t_h')),
    stay: clampInt(val('#t_stay'), 1, 1e6),
    pct: clampInt(val('#t_v'), 1, 10),
    cargo: {
      m: clampInt(val('#c_m'), 0, 1e15),
      c: clampInt(val('#c_c'), 0, 1e15),
      d: clampInt(val('#c_d'), 0, 1e15),
    },
  };
}

/** „Mond“ in the select of the target only where a moon is (#53). */
function moonOption(s: GameState): void {
  const select = $('#t_k') as HTMLSelectElement | null;
  if (!select) return;
  const to = readFleetForm().to;
  const option = select.querySelector<HTMLOptionElement>('option[value=moon]')!;
  option.disabled = !moonAt(s.galaxy, to);
  if (option.disabled && select.value === 'moon') select.value = 'planet';
}

/**
 * The list „Auftrag“ follows the target (#253): only the missions that fit
 * it, the chosen one kept while it fits, else the first; when none fits the
 * list says so and „Flotte losschicken“ is blocked. The line beside it names
 * the planets against the limit for a Landnahme (#237).
 */
function missionList(s: GameState, from: string): void {
  const list = $<HTMLSelectElement>('#t_m')!;
  const offered = offeredMissions(s, from, readFleetForm().to, client.now());
  const shown = Array.from(list.options, (o) => o.value).join();
  if (shown !== offered.join()) {
    const { html, selected } = missionOptions(offered, list.value);
    list.innerHTML = html;
    list.value = selected;
  }
  const send = $<HTMLButtonElement>('#t_send');
  if (send) send.disabled = send.dataset.full === '1' || !list.value;
  const limit = $('#t_limit');
  if (limit) limit.textContent = colonyNote(s, list.value);
}

function fleetCalc(): void {
  if (!$('#t_g') || !client.view || !client.game) return;
  moonOption(client.game);
  missionList(client.game, client.view.P.id);
  timeRow(val('#t_m'), client.view);
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

const shipInputs = () => document.querySelectorAll<HTMLInputElement>('.fs');

/** The ship selection: all, none, the most of one kind. */
const selectionActs = ({ setInput }: ClientCtx): Record<string, Handler> => ({
  fall: () => {
    shipInputs().forEach(
      (i) => (i.value = String(client.view!.P.ships[i.dataset.k!] ?? 0)),
    );
    fleetCalc();
  },
  fnone: () => {
    shipInputs().forEach((i) => (i.value = ''));
    fleetCalc();
  },
  fmax: (d) => {
    setInput(`#f_${d.k}`, client.view!.P.ships[d.k!] ?? 0);
    fleetCalc();
  },
});

/** The cargo: all of it evenly, all of one resource. */
const cargoActs = ({ setInput }: ClientCtx): Record<string, Handler> => ({
  cmax: () => {
    const c = cargoMax(settledPlanet(), readFleetForm());
    for (const k of CARGO) setInput(`#c_${k}`, c[k]);
    fleetCalc();
  },
  cone: (d) => {
    const k = d.k as keyof Resources;
    setInput(`#c_${k}`, cargoOne(settledPlanet(), readFleetForm(), k));
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
  field.value = '';
  if (!place) return;
  ctx.setInput('#t_g', place.g);
  ctx.setInput('#t_s', place.s);
  ctx.setInput('#t_p', place.p);
  ctx.setInput('#t_k', place.kind);
}

/** The data-act handlers of the fleet; the form is calculated again on every input. */
export const clientFeature = {
  acts: (ctx) => {
    document.addEventListener('change', (e) => {
      if (client.ui.view !== 'fleet') return;
      const field = (e?.target ?? null) as HTMLSelectElement | null;
      if (field?.id === 't_q') quickChoice(ctx, field);
      fleetCalc();
    });
    document.addEventListener('input', (e) => {
      if (
        client.ui.view === 'fleet' &&
        (e.target as HTMLElement).closest('main')
      )
        fleetCalc();
    });
    return { ...selectionActs(ctx), ...cargoActs(ctx), ...flightActs(ctx) };
  },
  afterRender: () => {
    if (client.ui.view === 'fleet') fleetCalc();
  },
} satisfies ClientFeature;
