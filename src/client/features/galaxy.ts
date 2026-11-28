// The handlers of the Sternenkarte (#45, #53, #54): stepping through the
// galaxies and systems, going to a position, the moon of a planet, the scan
// of the Phalanx (#69) and the shortcuts to the fleet form and to a spy
// probe, and the bottom sheet of a position on a phone (#189). The markup is in views/galaxy.ts and the Svelte components; the
// Raketenangriff is in features/missiles.ts.
import { protectionOf, shownParam } from '../../core/galaxy-shown.ts';
import { $ } from '../dom.ts';
import { galaxyStep } from '../logic/game.ts';
import { galaxyPosition, wanted } from '../logic/galaxy-position.svelte.ts';
import { GALAXY_VIEW } from '../logic/galaxy-shown.ts';
import { targetOf } from '../logic/galaxy.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';
import { freeShips } from '../logic/union.ts';

const ui = client.ui;

/** Which system the map shows: the arrows, the fields, the home system, a position. */
const moveActs = ({ go, render }: ClientCtx): Record<string, Handler> => ({
  gnav: (d) => {
    Object.assign(ui, galaxyStep(ui.gal, ui.sys, d.d ?? '', client.game!.cfg));
    render(true);
  },
  ggo: () => {
    Object.assign(ui, wanted(galaxyPosition, ui, client.game!.cfg));
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
      // The probes a planned start holds back stay (#478).
      freeShips(client.game!, client.view!.P).probe ?? 0,
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

/** The system whose list of the noob protection was asked for last (151a). */
let asked: string | null = null;
let load: (() => Promise<void>) | null = null;

/**
 * After a render of the Sternenkarte: a state with the list of the shown
 * system is loaded once when the state has none for it (another system, a
 * first visit), so a system switch brings its (n) at once (151a).
 */
export function askProtection(): void {
  const s = client.game;
  if (!s || ui.view !== GALAXY_VIEW) {
    asked = null;
    return;
  }
  const at = { g: ui.gal, s: ui.sys };
  if (protectionOf(s.protectedOwners, at)) return;
  const key = shownParam(at);
  if (asked === key) return;
  asked = key;
  void load?.();
}

/** The data-act handlers of the Sternenkarte; „Enter“ in a field of the position goes there. */
export const clientFeature = {
  listen: (ctx) => {
    load = ctx.refresh;
    const moves = moveActs(ctx);
    document.addEventListener('keydown', (e) => {
      const id = (e.target as HTMLElement).id;
      if (e.key === 'Enter' && id?.startsWith('g_')) moves.ggo!({});
    });
  },
  acts: (ctx) => ({ ...moveActs(ctx), ...targetActs(ctx) }),
  afterRender: askProtection,
} satisfies ClientFeature;
