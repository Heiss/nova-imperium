import type { NewsData } from '../logic/news.ts';
// Pieces shared by the views. Everything that comes from players goes through esc().
import type { Planet, ResearchState } from '../../core/types.ts';
import { dur } from '../logic/format.ts';
import type { Scan } from '../logic/phalanx.ts';
import type { HighscoreCategory } from '../logic/highscore.ts';
import type { PushChoice } from '../logic/push-options.ts';
import type { GameState } from '../logic/types.ts';

export interface Ui extends PushChoice {
  passwordMinLength?: number;
  /** Whether the server sends Web Push; else the options hide the push kinds (#192). */
  webPush?: boolean;
  view: string;
  /** The address parameters of the open view that it declares (`address`, #379), e.g. the guild of „Gilden“. */
  params: Readonly<Record<string, string>>;
  gal: number;
  sys: number;
  ft: { g: number; s: number; p: number; kind?: 'planet' | 'moon' } | null;
  /** The moon whose actions the Sternenkarte shows (#53), by its id. */
  gmoon?: string | null;
  /** The place whose actions the bottom sheet „⋯“ of the Sternenkarte shows on a phone (#189), by its id. */
  gsheet?: string | null;
  /** The answer of the last scan of the Auspex-Phalanx (#53), shown from its moon. */
  scan?: Scan | null;
  fm: string;
  /** The kind of target the player chose in the fleet form, kept over a redraw (the „Mond“ option is not there yet then). */
  fk?: 'planet' | 'moon' | undefined;
  /** The attack union the fleet form joins (#225), by id; none when empty. */
  union?: string | null;
  openRep: Record<string, boolean>;
  /** Entries whose explanation the player opened with the (?) (issue #63). */
  openEx: Record<string, boolean>;
  /** Entries whose level overview the player unfolded with the ▤ (#187). */
  openLv?: Record<string, boolean>;
  auth: 'login' | 'register' | 'forgot' | 'reset' | 'code' | null;
  invite: { token: string; email: string; galaxies: number } | null;
  lastLink: string | null;
  /** Planet animations of this viewer (Hilfe & Optionen, issue #61 D9). */
  animations: boolean;
  /** „Neuigkeiten“ from the server, null until loaded (issue #81). */
  news: NewsData | null;
  /** The newest version whose news were opened on this device. */
  newsSeen: string | null;
  /** Request ID of the last API answer, for „Problem melden“ (issue #126). */
  lastRequestId?: string | null;
  /** The category the highscore shows (#78), „Gesamt“ until one is chosen. */
  highscore?: HighscoreCategory;
}

/** What every view gets: the state, the planet and research moved to now. */
export interface V {
  s: GameState;
  P: Planet;
  R: ResearchState;
  now: number;
  ui: Ui;
}

/** A countdown; the clock in main.ts updates it every second. */
export const cd = (end: number, now: number): string =>
  end > now
    ? `<span class="cd" data-end="${end}">${dur(end - now)}</span>`
    : '<span class="dim">gleich …</span>';

export const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;
