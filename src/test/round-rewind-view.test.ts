// The component RoundRewind and its place in the archive (#235, view G),
// rendered on the server side of Svelte: the card that is shown, the controls,
// the live line, the heading that takes the focus, the state without motion
// (a stubbed `matchMedia`), and the button „Rewind ansehen“ of the list. The
// keys, the swipe and the play are the rules of logic/round-rewind.ts and
// logic/round-rewind.svelte.ts, tested there.
import { render } from 'svelte/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rewind } from '../core/round-rewind.ts';
import type { RoundEntry } from '../core/round-report.ts';
import {
  type ArchiveState,
  forgetArchive,
} from '../client/logic/round-archive.ts';
import { rewindPage } from '../client/logic/round-rewind.ts';
import { resetRewind, rewindUi } from '../client/logic/round-rewind.svelte.ts';
import RoundRewind from '../client/views/RoundRewind.svelte';
import { stripComments, textContents } from './markup.ts';
import { archiveView } from './round-archive-view.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 12);

const REWIND: Rewind = {
  round: 3,
  cards: [
    {
      kind: 'identity',
      slot: 1,
      number: 3,
      started: START,
      closed: START + 30 * DAY,
      days: 30,
      participants: 3,
      coverage: 'complete',
    },
    { kind: 'playtime', slot: 6, ms: 760 * 60_000, partial: false },
    {
      kind: 'rank',
      slot: 8,
      number: 3,
      rank: 2,
      of: 3,
      points: 8400,
      tied: false,
      winner: { name: 'Lea', points: 9100, you: false },
    },
  ],
};

const view = (r: Rewind = REWIND): string =>
  stripComments(render(RoundRewind, { props: { page: rewindPage(r) } }).body);

beforeEach(resetRewind);
afterEach(() => {
  vi.unstubAllGlobals();
  forgetArchive();
});

describe('the card that is shown', () => {
  it('opens on card 1 with the headline, the number and the lines of the issue', () => {
    const text = textContents(view());
    expect(text).toContain('h3: Runden-Rewind · Runde 3');
    expect(text).toContain('p: Runde 3');
    expect(text).toContain('h4: Dein Runden-Rewind');
    expect(text).toContain('p: 30 Tage');
    expect(text).toContain('p: Du warst einer von 3 Teilnehmern.');
    // Only one card at a time.
    expect(text.join('\n')).not.toContain('Du warst nicht ständig hier.');
  });

  it('shows card 6 with the estimated active time and its method', () => {
    rewindUi.index = 1;
    const text = textContents(view());
    expect(text).toContain('h4: Du warst nicht ständig hier.');
    expect(text).toContain('p: 12 h 40');
    expect(text).toContain('p: Deine geschätzte aktive Zeit in dieser Runde.');
    expect(text.join('\n')).toContain(
      'Methode: Gezählt wird die geschätzte Zeit',
    );
  });

  it('shows card 8 with the place and the way to the full report', () => {
    rewindUi.index = 2;
    const html = view();
    const text = textContents(html);
    expect(text).toContain('h4: Dein Platz in der Chronik.');
    expect(text).toContain('p: 2 von 3');
    expect(text).toContain('p: Sieger: Lea mit 9.100 Punkten.');
    expect(text).toContain('button: Vollständigen Bericht öffnen');
    expect(html).toContain('data-act="roundOpen" data-round="3"');
  });

  it('keeps the index inside the cards if the state is stale', () => {
    rewindUi.index = 9;
    expect(textContents(view())).toContain('h4: Dein Platz in der Chronik.');
  });

  it('shows a thin Rewind of two cards without the card 6', () => {
    const thin: Rewind = {
      round: 3,
      cards: [REWIND.cards[0]!, REWIND.cards[2]!],
    };
    const first = textContents(view(thin)).join('\n');
    expect(first).toContain('Karte 1 von 2');
    rewindUi.index = 1;
    const second = textContents(view(thin)).join('\n');
    expect(second).toContain('Dein Platz in der Chronik.');
    for (const text of [first, second])
      expect(text).not.toContain('Du warst nicht ständig hier.');
  });
});

describe('the controls', () => {
  it('has back to the archive, previous (off on the first card), next and the play', () => {
    const html = view();
    const text = textContents(html);
    expect(text).toContain('button: Zurück zum Archiv');
    expect(text).toContain('button: Zurück');
    expect(text).toContain('button: Weiter');
    expect(text).toContain('button: Automatisch abspielen');
    expect(html).toContain('data-act="rewindBack"');
    expect(html).toMatch(/data-rw="prev"[^>]*disabled/);
    expect(html).not.toMatch(/data-rw="next"[^>]*disabled/);
  });

  it('switches next off on the last card and offers the replay', () => {
    rewindUi.index = 2;
    const html = view();
    expect(html).toMatch(/data-rw="next"[^>]*disabled/);
    expect(html).not.toMatch(/data-rw="prev"[^>]*disabled/);
    expect(textContents(html)).toContain('button: Noch einmal abspielen');
  });

  it('names the pause while the play runs', () => {
    rewindUi.playing = true;
    expect(textContents(view())).toContain('button: Pause');
  });

  it('has no play for a single card', () => {
    const one: Rewind = { round: 3, cards: [REWIND.cards[0]!] };
    const text = textContents(view(one)).join('\n');
    expect(text).not.toContain('abspielen');
    expect(text).toContain('Karte 1 von 1');
  });
});

describe('for assistive technology', () => {
  it('has a heading that can take the focus and a polite live line', () => {
    const html = view();
    expect(html).toContain('id="round-rewind-card-h"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-labelledby="round-rewind-h"');
    // The progress segments are decoration; the card count is text.
    expect(html).toContain('<ol class="rw-bar" aria-hidden="true">');
  });

  it('tells only the position by the live line while the player turns the cards', () => {
    expect(textContents(view())).toContain('p: Karte 1 von 3');
  });

  it('tells the stable card by the live line while the play runs', () => {
    rewindUi.playing = true;
    rewindUi.index = 1;
    expect(textContents(view())).toContain(
      'p: Karte 2 von 3: Du warst nicht ständig hier. 12 h 40',
    );
  });
});

describe('without motion', () => {
  it('moves the card in by default', () => {
    const html = view();
    expect(html).toContain('data-still="false"');
    expect(html).not.toMatch(/class="rw still"/);
  });

  it('stands still when the system asks for reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(prefers-reduced-motion: reduce)',
    }));
    const html = view();
    expect(html).toContain('data-still="true"');
    expect(html).toMatch(/class="rw[^"]*\bstill\b/);
    // The content is the same: no card waits for an animation.
    expect(textContents(html)).toContain('h4: Dein Runden-Rewind');
  });
});

const entry = (over: Partial<RoundEntry>): RoundEntry => ({
  number: 3,
  status: 'closed',
  started: START,
  closed: START + 30 * DAY,
  coverage: 'complete',
  locked: false,
  participants: 3,
  you: { rank: 2, of: 3, points: 8400 },
  ...over,
});

const at = (over: Partial<ArchiveState>): ArchiveState => ({
  user: 'u_me',
  round: 4,
  entries: [],
  history: [],
  report: null,
  rewind: null,
  category: 'total',
  loading: false,
  error: null,
  ...over,
});

describe('in the archive', () => {
  it('offers „Rewind ansehen“ beside the report of a finished round the player took part in', () => {
    const html = archiveView(at({ entries: [entry({})] }));
    expect(textContents(html)).toContain('td: Bericht öffnen Rewind ansehen');
    expect(html).toContain('data-act="rewindOpen" data-round="3"');
  });

  it('offers it to the admin too, before „Löschen“, for a round they took part in only', () => {
    const rows = [entry({ number: 2 }), entry({ number: 1, you: null })];
    const html = archiveView(at({ entries: rows }), true);
    const cells = textContents(html).filter((t) => t.startsWith('td: Bericht'));
    expect(cells).toEqual([
      'td: Bericht öffnen Rewind ansehen Löschen',
      'td: Bericht öffnen Löschen',
    ]);
  });

  it('offers none for the running round, a locked one or a round without a place', () => {
    const rows = [
      entry({
        number: 6,
        status: 'active',
        closed: null,
        locked: true,
        you: null,
      }),
      entry({ number: 5, status: 'active', closed: null, you: null }),
      entry({ number: 4, you: null }),
    ];
    const text = textContents(archiveView(at({ entries: rows }), true)).join(
      '\n',
    );
    expect(text).not.toContain('Rewind ansehen');
  });

  it('shows the Rewind in place of the list, with no list and no admin button above it', () => {
    const html = archiveView(
      at({ entries: [entry({})], rewind: REWIND }),
      true,
    );
    const text = textContents(html).join('\n');
    expect(text).toContain('Dein Runden-Rewind');
    expect(text).not.toContain('Runde abschließen');
    expect(text).not.toContain('Rewind ansehen');
    expect(text).not.toContain('Bericht öffnen');
  });

  it('shows a report before the Rewind if both were set', () => {
    const report = {
      round: {
        number: 3,
        provisional: false,
        asOf: START,
        started: START,
        closed: START,
        days: 1,
        coverage: 'complete',
        rules: {},
      },
      you: null,
      rows: [],
      guilds: [],
      playtime: null,
    } as unknown as ArchiveState['report'];
    const text = textContents(archiveView(at({ report, rewind: REWIND }))).join(
      '\n',
    );
    expect(text).toContain('Runde 3');
    expect(text).not.toContain('Dein Runden-Rewind');
  });
});
