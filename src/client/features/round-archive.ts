// The browser side of the round archive (#235): reading the list, the report
// and the history from the server (actions `roundArchive`, `roundReport`,
// `roundHistory`), opening and closing a report or the Rewind (`roundRewind`), the category of its ranking,
// and the admin's „Runde abschließen“ and „Löschen“. The server decides what
// a reader may see; nothing is kept in the state of the game (a locked round
// is never sent). The boxes are in logic/round-archive.ts.
import {
  archive,
  closeText,
  deleteText,
  forgetArchive,
  needsLoad,
} from '../logic/round-archive.ts';
import { highscoreCategory } from '../logic/highscore.ts';
import { resetRewind } from '../logic/round-rewind.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientCtx, ClientFeature, Data } from './contract.ts';

/** The views that show the archive. */
const VIEWS: readonly string[] = ['help', 'admin'];

/** What an action of the archive sent back, in `data`. */
const dataOf = (answer: Record<string, unknown>): Record<string, unknown> =>
  (answer.data ?? {}) as Record<string, unknown>;

const call = (ctx: ClientCtx, type: string, extra: object = {}) =>
  ctx.api('/api/action', { type, ...extra }).then(dataOf);

/** Reads the list and the history; a refusal shows as the note of the box and stops the loading. */
async function load(ctx: ClientCtx): Promise<void> {
  archive.loading = true;
  try {
    const [list, history] = await Promise.all([
      call(ctx, 'roundArchive'),
      call(ctx, 'roundHistory'),
    ]);
    archive.entries = list.rounds as typeof archive.entries;
    archive.history = history.history as typeof archive.history;
    archive.error = null;
  } catch (e) {
    archive.entries = [];
    archive.error = (e as Error).message;
  } finally {
    archive.loading = false;
    ctx.render();
  }
}

/** Reads again after a change of the archive. */
async function reload(ctx: ClientCtx): Promise<void> {
  const user = client.game?.me.id ?? null;
  const round = client.game?.round.number ?? null;
  forgetArchive();
  archive.user = user;
  archive.round = round;
  await load(ctx);
}

/** The thin Rewind (#235, view G): read from the server like a report, so a round the reader may not open is refused there. */
const rewindActs = (ctx: ClientCtx) => ({
  rewindOpen: async (d: Data) => {
    try {
      const data = await call(ctx, 'roundRewind', { round: Number(d.round) });
      archive.rewind = data.rewind as typeof archive.rewind;
      resetRewind();
      ctx.render();
      document.getElementById('round-rewind-card-h')?.focus();
    } catch (e) {
      ctx.toast((e as Error).message, true);
    }
  },
  rewindBack: () => {
    archive.rewind = null;
    ctx.render();
  },
});

let bound: ClientCtx | null = null;

export const clientFeature = {
  acts: (ctx) => {
    bound = ctx;
    return {
      roundOpen: async (d) => {
        try {
          const data = await call(ctx, 'roundReport', {
            round: Number(d.round),
          });
          archive.report = data.report as typeof archive.report;
          archive.rewind = null;
          archive.category = 'total';
          ctx.render();
          document.getElementById('round-report-h')?.focus();
        } catch (e) {
          ctx.toast((e as Error).message, true);
        }
      },
      roundBack: () => {
        archive.report = null;
        ctx.render();
      },
      ...rewindActs(ctx),
      roundCat: (d) => {
        archive.category = highscoreCategory(d.cat);
        ctx.render();
      },
      roundClose: async () => {
        if (!window.confirm(closeText(client.game?.round.number ?? 0))) return;
        if (await ctx.act('closeRound')) await reload(ctx);
      },
      roundDelete: async (d) => {
        if (!window.confirm(deleteText(d.round))) return;
        if (await ctx.act('deleteRound', { round: Number(d.round) }))
          await reload(ctx);
      },
    };
  },
  afterRender: () => {
    const user = client.game?.me.id;
    const round = client.game?.round.number;
    if (!bound || !user || round === undefined) return;
    if (!VIEWS.includes(client.ui.view)) return;
    if (needsLoad(user, round)) void load(bound);
  },
} satisfies ClientFeature;
