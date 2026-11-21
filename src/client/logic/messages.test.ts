// What the list of reports shows (#118, bundle 4): the reports newest first,
// each with its time, whether it is new or open, and its body.
import { describe, expect, it } from 'vitest';
import type { Ui, V } from '../views/common.ts';
import { messagesPage } from './messages.ts';
import type { Report } from './types.ts';

const report = (over: Partial<Report>): Report => ({
  id: 'r1',
  time: 1_000,
  type: 'info',
  title: 'Bericht',
  ...over,
});

const view = (reports: Report[], readAt?: number, open: string[] = []): V =>
  ({
    s: { me: { readAt }, reports },
    ui: {
      openRep: Object.fromEntries(open.map((id) => [id, true])),
    } as unknown as Ui,
  }) as unknown as V;

describe('the list of reports', () => {
  it('lists the reports newest first with their count', () => {
    const page = messagesPage(
      view([
        report({ id: 'a', time: 1 }),
        report({ id: 'b', time: 3 }),
        report({ id: 'c', time: 2 }),
      ]),
    );
    expect(page.count).toBe(3);
    expect(page.rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('marks the reports after the last reading as new, all of them before the first', () => {
    const reports = [
      report({ id: 'a', time: 5 }),
      report({ id: 'b', time: 9 }),
    ];
    expect(
      messagesPage(view(reports, 5)).rows.map((r) => [r.id, r.fresh]),
    ).toEqual([
      ['b', true],
      ['a', false],
    ]);
    expect(messagesPage(view(reports)).rows.every((r) => r.fresh)).toBe(true);
  });

  it('marks the reports the player opened', () => {
    const page = messagesPage(
      view([report({ id: 'a', time: 3 }), report({ id: 'b', time: 2 })], 0, [
        'a',
      ]),
    );
    expect(page.rows.map((r) => [r.id, r.open])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('has an empty list without reports', () => {
    expect(messagesPage(view([]))).toEqual({ count: 0, rows: [] });
  });
});

describe('the body of a report', () => {
  const body = (over: Partial<Report>) =>
    messagesPage(view([report(over)])).rows[0]!.body;

  it('is the text of a plain report, empty without one', () => {
    expect(body({ text: 'Deine Flotte ist zurück.' })).toEqual({
      kind: 'text',
      text: 'Deine Flotte ist zurück.',
    });
    expect(body({})).toEqual({ kind: 'text', text: '' });
  });

  it('is the lines of an update message with the link to the news', () => {
    expect(body({ news: '26.11.1', text: 'Neu:\n• A' })).toEqual({
      kind: 'update',
      lines: ['Neu:', '• A'],
      link: '?view=news',
    });
    expect(body({ news: '26.11.1' })).toEqual({
      kind: 'update',
      lines: [''],
      link: '?view=news',
    });
  });

  it('holds the values of a battle, an espionage and a survey report', () => {
    const spy = body({
      type: 'spy',
      name: 'Beta',
      coords: { g: 1, s: 2, p: 6 },
      defName: 'Bert',
      res: { m: 1, c: 2, d: 3 },
      counter: 0,
    });
    expect(spy.kind).toBe('report');
    expect(spy).toMatchObject({ body: { kind: 'spy', counter: '0' } });
  });
});
