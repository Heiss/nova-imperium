// The handlers of the Sternenkarte (#45, #53, #54): stepping through the
// galaxies and systems, going to a position, the moon of a planet, the scan
// of the Phalanx (#69) and the shortcuts to the fleet form and to a spy
// probe, and the bottom sheet of a position on a phone (#189). The markup is in views/galaxy.ts and the Svelte components; the
// Raketenangriff is in features/missiles.ts.
import { $, val } from '../dom.ts';
import { clampInt } from '../logic/format.ts';
import { galaxyStep } from '../logic/game.ts';
import { targetOf } from '../logic/galaxy.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';

const ui = client.ui;

/** Which system the map shows: the arrows, the fields, the home system, a position. */
const moveActs = ({ go, render }: ClientCtx): Record<string, Handler> => ({
  gnav: (d) => {
    Object.assign(ui, galaxyStep(ui.gal, ui.sys, d.d ?? '', client.game!.cfg));
    render(true);
  },
  ggo: () => {
    ui.gal = clampInt(val('#g_g'), 1, client.game!.cfg.galaxies);
    ui.sys = clampInt(val('#g_s'), 1, client.game!.cfg.systems);
    render(true);
  },
  ghome: () => {
    const home =
      client.game!.galaxy.find((p) => p.id === client.game!.mainPlanet) ??
      client.view!.P;
    ui.gal = home.g;
    ui.sys = home.s;
    render(true);
  },
  gto: (d) => {
    ui.gal = Number(d.g);
    ui.sys = Number(d.s);
    go('galaxy');
  },
});

/**
 * The focus goes back to the scan button of the planet, while it is shown; on
 * a phone that button is in the sheet, so it goes to the „⋯“ of the planet
 * (#189).
 */
function focusScanButton(target: string): void {
  const button = $(`[data-act=gscan][data-id="${CSS.escape(target)}"]`);
  (button?.offsetParent === null
    ? $(`#gsheet-${CSS.escape(target)}`)
    : button
  )?.focus();
}

/** What a planet of the map offers: its moon, a scan, the fleet form, a probe. */
const targetActs = ({
  act,
  actHere,
  go,
  render,
  toast,
}: ClientCtx): Record<string, Handler> => ({
  gmoon: (d) => {
    ui.gmoon = ui.gmoon === d.id ? null : (d.id ?? null);
    render(true);
  },
  gscan: async (d) => {
    if (!(await actHere('scan', { target: d.id }))) return;
    render(true);
    $('#scan-h')?.focus();
  },
  gscanClose: () => {
    const target = ui.scan?.target;
    ui.scan = null;
    render(true);
    if (target) focusScanButton(target);
  },
  // The „⋯“ of a position on a phone opens the bottom sheet of its actions (#189).
  gsheet: (d) => {
    ui.gsheet = d.id ?? null;
    render(true);
  },
  gfleet: (d) => {
    ui.ft = targetOf(d);
    ui.fm = d.m ?? 'attack';
    ui.fk = ui.ft.kind;
    go('fleet');
  },
  gspy: (d) => {
    const n = Math.min(
      client.view!.P.ships.probe ?? 0,
      client.game!.me.probes || 1,
    );
    if (!n) return toast('Keine Spähschädel auf dem Planeten.', true);
    return act('send', {
      ships: { probe: n },
      to: targetOf(d),
      mission: d.m ?? 'spy',
      pct: 10,
      cargo: { m: 0, c: 0, d: 0 },
    });
  },
});

/** The data-act handlers of the Sternenkarte; „Enter“ in a field of the position goes there. */
export const clientFeature = {
  acts: (ctx) => {
    const moves = moveActs(ctx);
    document.addEventListener('keydown', (e) => {
      const id = (e.target as HTMLElement).id;
      if (e.key === 'Enter' && id?.startsWith('g_')) moves.ggo!({});
    });
    return { ...moves, ...targetActs(ctx) };
  },
} satisfies ClientFeature;
