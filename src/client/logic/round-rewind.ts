// The words and the rules of the thin Runden-Rewind in the browser (#235, view
// G, okf/features/round-archive.md): the cards as the component RoundRewind
// shows them, made from the facts of the server (core/round-rewind.ts), and
// the small rules of its controls (the arrow keys, the swipe, the motion). The
// server decides who may see a Rewind and which cards exist; nothing here
// counts or guesses a fact. The headlines of the cards 1, 6 and 8 are those of
// the issue; every other text is a draft of Claude [V].
import type {
  IdentityCard,
  PlaytimeCard,
  RankCard,
  Rewind,
  RewindCard,
} from '../../core/round-rewind.ts';
import { fmt } from './format.ts';
import { OWN_ACTIVITY_HELP, playtime } from './own-activity.ts';
import { COVERAGE, day, daysText } from './round-words.ts';

/** One card as the component shows it. */
export interface RewindCardPage {
  key: RewindCard['kind'];
  /** The small line above the headline. */
  kicker: string;
  headline: string;
  /** The large number in Cinzel. */
  figure: string;
  /** The story text and the method, one paragraph each. */
  lines: string[];
  /** The round whose full report the card links to; null on the other cards. */
  report: number | null;
}

/** The Rewind as the component shows it. */
export interface RewindPage {
  round: number;
  heading: string;
  cards: RewindCardPage[];
}

const two = (n: number): string => String(n).padStart(2, '0');

/** An active time as the Rewind tells it: „12 h 40“ from an hour, below it the words of „Optionen“. */
export function rewindDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${two(minutes % 60)}`
    : playtime(ms);
}

function identity(c: IdentityCard): RewindCardPage {
  const lines = [
    `Runde ${c.number}: ${day(c.started)} bis ${day(c.closed)}.`,
    c.participants === 1
      ? 'Du warst der einzige Teilnehmer.'
      : `Du warst einer von ${c.participants} Teilnehmern.`,
  ];
  if (c.coverage === 'partial') lines.push(COVERAGE.partial);
  return {
    key: c.kind,
    kicker: `Runde ${c.number}`,
    headline: 'Dein Runden-Rewind',
    figure: daysText(c.days),
    lines,
    report: null,
  };
}

function playtimeCard(c: PlaytimeCard): RewindCardPage {
  const lines = [
    'Deine geschätzte aktive Zeit in dieser Runde.',
    `Methode: ${OWN_ACTIVITY_HELP} Gleichzeitig geöffnete Fenster zählen einmal.`,
  ];
  if (c.partial) lines.push('Die Zeit vor Beginn der Erfassung fehlt.');
  return {
    key: c.kind,
    kicker: 'Spielzeit',
    headline: 'Du warst nicht ständig hier.',
    figure: rewindDuration(c.ms),
    lines,
    report: null,
  };
}

function rank(c: RankCard): RewindCardPage {
  const lines = [`Endplatz nach Punkten: ${fmt(c.points)} Punkte.`];
  lines.push(
    c.winner.you
      ? 'Du hast die Runde gewonnen.'
      : `Sieger: ${c.winner.name} mit ${fmt(c.winner.points)} Punkten.`,
  );
  if (c.tied)
    lines.push(
      'Ein anderer Spieler hat genauso viele Punkte; bei Gleichstand ordnet der Bericht nach der Nummer des Platzes.',
    );
  return {
    key: c.kind,
    kicker: 'Endplatz',
    headline: 'Dein Platz in der Chronik.',
    figure: `${c.rank} von ${c.of}`,
    lines,
    report: c.number,
  };
}

const card = (c: RewindCard): RewindCardPage =>
  c.kind === 'identity'
    ? identity(c)
    : c.kind === 'playtime'
      ? playtimeCard(c)
      : rank(c);

/** The cards of the Rewind in the order of the server. */
export const rewindPage = (r: Rewind): RewindPage => ({
  round: r.round,
  heading: `Runden-Rewind · Runde ${r.round}`,
  cards: r.cards.map(card),
});

/** The words of the controls. */
export const REWIND_WORDS = {
  back: 'Zurück zum Archiv',
  prev: 'Zurück',
  next: 'Weiter',
  play: 'Automatisch abspielen',
  pause: 'Pause',
  replay: 'Noch einmal abspielen',
  report: 'Vollständigen Bericht öffnen',
} as const;

/** The time one card stays in the automatic play [V]. */
export const AUTOPLAY_MS = 7000;

/** How far a finger must travel sideways to turn the card, in pixels [V]. */
const SWIPE_MIN = 48;

/** The card that follows an arrow key: -1 back, 1 forward, 0 for any other key. */
export const keyStep = (key: string): -1 | 0 | 1 =>
  key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;

/**
 * The card that follows a swipe of `dx` by `dy` pixels: a swipe to the left
 * turns forward, to the right back; a short or mostly vertical stroke (the
 * page scrolling) turns nothing.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** The index after a step, kept inside the cards. */
export const stepIndex = (index: number, step: number, count: number): number =>
  Math.max(0, Math.min(count - 1, index + step));

/**
 * Whether the Rewind stays without motion: the system asks for reduced motion
 * or the player switched the animations off in „Optionen“ (`no-anim` on the
 * page). Then no card fades in; the content never waits for an animation.
 */
export function stillMotion(): boolean {
  const reduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const off =
    typeof document !== 'undefined' &&
    !!document.documentElement?.classList.contains('no-anim');
  return reduced || off;
}
