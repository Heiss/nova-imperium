// „Nachrichten“ renders as before #118, bundle 4 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: messages(), reportHTML(), the body of a plain
// report and updateMessageHTML() of the views and logic before this step.
// The bodies of battle, espionage and survey reports are the functions of
// logic/report-body.ts, which both sides call. On generated states (fixed
// fast-check seed 118) both render the same markup, up to what a browser
// does not show (normalize() of markup.ts); hand-built cases reach the rare
// branches.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dt, esc } from '../client/logic/format.ts';
import { newestFirst } from '../client/logic/game.ts';
import { reportBodyHTML } from '../client/logic/report-body.ts';
import type { Report } from '../client/logic/types.ts';
import type { Ui, V } from '../client/views/common.ts';
import { messagesView } from './messages-view.ts';
import { normalize } from './markup.ts';

// ----- frozen: src/client/views/messages.ts before #118, bundle 4 -----

function updateMessageHTML(text: string, link: string): string {
  const lines = text
    .split('\n')
    .map((line) => esc(line))
    .join('<br>');
  return `<div>${lines}</div><p><a href="${esc(link)}" data-act="nav" data-v="news">Zu den Neuigkeiten</a></p>`;
}

function reportBody(r: Report): string {
  const html = reportBodyHTML(r);
  if (html !== null) return html;
  if (typeof r.news === 'string')
    return updateMessageHTML(String(r.text ?? ''), '?view=news');
  return `<div>${esc(r.text)}</div>`;
}

function reportHTML(v: V, r: Report, readAt: number): string {
  const cls = `rep ${r.time > readAt ? 'new' : ''} ${v.ui.openRep[r.id] ? 'open' : ''}`;
  return `<div class="${cls}" id="rep_${esc(r.id)}"><div class="t" data-act="toggleRep" data-id="${esc(r.id)}"><b>${esc(r.title)}</b><span class="dim">${dt(r.time)} <span class="lnk" data-act="delrep" data-id="${esc(r.id)}">löschen</span></span></div><div class="b">${reportBody(r)}</div></div>`;
}

function messages(v: V): string {
  const readAt = v.s.me.readAt || 0;
  const list = newestFirst(v.s.reports);
  const del = list.length
    ? '<button class="small red" data-act="delall">Alle löschen</button>'
    : '';
  const body = list.length
    ? list.map((r) => reportHTML(v, r, readAt)).join('')
    : '<div class="bd dim">Keine Nachrichten.</div>';
  return `<h2>Nachrichten</h2><div class="box"><div class="hd flex between">Berichte (${list.length}) ${del}</div>${body}</div>`;
}

// ----- the comparison -----

/** What a title or text may hold that is not plain text. */
const WORDS = [
  'Deine Flotte ist zurück.',
  'Zeile eins\nZeile <zwei> & "drei"\n',
  "Ein 'Apostroph' > 3",
  '',
] as const;
const IDS = ['r1', 'r2', 'r3', 'r4', 'r<5>', 'r"6'] as const;

const report = fc.record({
  id: fc.constantFrom(...IDS),
  time: fc.integer({ min: 0, max: 2_000_000 }),
  title: fc.constantFrom('Bericht', 'Bericht <b>', 'Auspex & Co'),
  type: fc.constantFrom('text', 'battle', 'spy', 'other'),
  text: fc.option(fc.constantFrom(...WORDS), { nil: undefined }),
  news: fc.option(fc.constantFrom('26.11.1'), { nil: undefined }),
  // The fields of a battle and an espionage report, as far as the bodies read them.
  name: fc.constant('Beta <i>'),
  coords: fc.constant({ g: 1, s: 2, p: 6 }),
  rounds: fc.integer({ min: 1, max: 6 }),
  attName: fc.constant('Anna'),
  defName: fc.constant('Bert'),
  attBefore: fc.constant({ lf: 4 }),
  attAfter: fc.constant({ lf: 1 }),
  defBefore: fc.constant({ lf: 2, rl: 3 }),
  defAfter: fc.constant({ rl: 1 }),
  winner: fc.constantFrom('att', 'def', 'draw'),
  res: fc.constant({ m: 5, c: 4, d: 3 }),
  counter: fc.integer({ min: 0, max: 100 }),
  ships: fc.option(fc.constant({ lf: 2 }), { nil: undefined }),
  lost: fc.boolean(),
});

const state = fc
  .record({
    reports: fc.uniqueArray(report, {
      maxLength: 6,
      selector: (r) => r.id,
    }),
    readAt: fc.option(fc.integer({ min: 0, max: 2_000_000 }), {
      nil: undefined,
    }),
    open: fc.array(fc.constantFrom(...IDS), { maxLength: 3 }),
  })
  .map(
    (x): V =>
      ({
        s: { me: { readAt: x.readAt }, reports: x.reports },
        ui: {
          openRep: Object.fromEntries(x.open.map((id) => [id, true])),
        } as unknown as Ui,
      }) as unknown as V,
  );

/** One report of each kind, opened or not, new or read. */
const one = (over: Record<string, unknown>, open = false): V =>
  ({
    s: {
      me: { readAt: 100 },
      reports: [{ id: 'r1', time: 200, title: 'Bericht', ...over }],
    },
    ui: { openRep: open ? { r1: true } : {} },
  }) as unknown as V;

const HAND_BUILT: [string, V][] = [
  [
    'no reports',
    { s: { me: {}, reports: [] }, ui: { openRep: {} } } as unknown as V,
  ],
  ['a new text report', one({ text: 'Hallo <b>' })],
  [
    'a read, opened update message',
    one({ text: 'A\nB', news: 'x', time: 50 }, true),
  ],
  ['an update message without text', one({ news: 'x' })],
  ['a report without text', one({ type: 'other' })],
];

describe('Messages against the view before #118, bundle 4', () => {
  it('renders the list as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(messagesView(v))).toBe(normalize(messages(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      expect(normalize(messagesView(v)), name).toBe(normalize(messages(v)));
  });
});
