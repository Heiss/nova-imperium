// „Problem melden“ of an error message names the call the error comes from,
// never the last answer of any call (the poll may have answered meanwhile).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from './logic/state.svelte.ts';
import { ApiError } from './logic/transport.ts';
import { toast } from './toast.ts';
import type { GameState } from './logic/types.ts';

interface Node {
  tag: string;
  className: string;
  textContent: string;
  dataset: Record<string, string>;
  children: Node[];
  append: (child: Node) => void;
  setAttribute: () => void;
  remove: () => void;
}

let shown: Node[];

const node = (tag: string): Node => {
  const n: Node = {
    tag,
    className: '',
    textContent: '',
    dataset: {},
    children: [],
    append: (child) => void n.children.push(child),
    setAttribute: () => undefined,
    remove: () => undefined,
  };
  return n;
};

/** The data of the button „Problem melden“ of the newest note, or null without one. */
const offer = (): Record<string, string> | null =>
  shown.at(-1)?.children.find((c) => c.tag === 'button')?.dataset ?? null;

beforeEach(() => {
  shown = [];
  vi.useFakeTimers();
  vi.stubGlobal('document', {
    createElement: node,
    body: { appendChild: (n: Node) => void shown.push(n) },
  });
  client.game = { me: { id: 'u1' } } as unknown as GameState;
  client.ui.view = 'fleet';
  // The last answer of any call: the poll, not the failed call.
  client.ui.lastRequestId = 'poll-id';
});
afterEach(() => {
  client.game = null;
  client.ui.lastRequestId = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('„Problem melden“ of an error message', () => {
  it('names the failed call, not the call that answered last', () => {
    const error = new ApiError(
      'Interner Fehler. Vorgang: failed-id',
      'failed-id',
    );
    toast(error.message, error);
    expect(offer()).toEqual({
      act: 'reportProblem',
      message: 'Interner Fehler. Vorgang: failed-id',
      page: 'fleet',
      request: 'failed-id',
    });
  });

  it('names no call for a message of the page itself or an error of no call', () => {
    toast('Keine Spähschädel auf dem Planeten.', true);
    expect(offer()?.request).toBe('');
    toast('Abgebrochen.', new Error('Abgebrochen.'));
    expect(offer()?.request).toBe('');
    toast('Kein Vorgang.', new ApiError('Kein Vorgang.', null));
    expect(offer()?.request).toBe('');
  });

  it('is offered for errors of a signed-in player only', () => {
    toast('Gebaut.');
    expect(offer()).toBeNull();
    toast('Gebaut.', false);
    expect(offer()).toBeNull();
    client.game = null;
    toast('Fehler.', true);
    expect(offer()).toBeNull();
  });
});
