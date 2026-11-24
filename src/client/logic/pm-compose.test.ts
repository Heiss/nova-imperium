// The dialog of a message (#349): the quick choice of the recipient, the
// drafts, the count, the key that sends, the field that gets the focus and
// the quoted message (owner, 2026-11-22, decisions 2 to 5).
import { afterEach, describe, expect, it } from 'vitest';
import {
  countText,
  draftOf,
  dropDraft,
  firstField,
  forgetDrafts,
  keepDraft,
  lastReceived,
  PM_DIALOG_LABELS,
  quickChoice,
  quoteHeading,
  RECENT_MAX,
  sendsOnKey,
} from './pm-compose.ts';
import type { MessageLine } from './private-messages.ts';
import type { GameState } from './types.ts';

const pm = (id: number) => ({
  id,
  mine: false,
  time: id,
  text: 'x',
  read: true,
});

const conversation = (name: string | null, id: number) => ({
  with: name,
  unread: 0,
  more: false,
  last: pm(id),
});

type Quick = Parameters<typeof quickChoice>[0];

const state = (over: Partial<GameState> = {}): Quick =>
  ({
    players: {
      u_Anna: { name: 'Anna', points: 1 },
      u_Bert: { name: 'Bert', points: 1 },
      u_Cora: { name: 'Cora', points: 1 },
      u_Dirk: { name: 'Dirk', points: 1 },
    },
    ...over,
  }) as Quick;

const messages = (
  names: (string | null)[],
  blocked: string[] = [],
): GameState['privateMessages'] => ({
  friendsOnly: false,
  blocked,
  conversations: names.map((n, i) => conversation(n, 100 - i)),
});

const friends = (...ids: string[]): GameState['friends'] => ({
  list: ids.map((id) => ({ id, online: false })),
  incoming: [],
  outgoing: [],
});

describe('the quick choice under „Empfänger“ (owner, 2026-11-22, decision 4)', () => {
  it('offers the conversations of the inbox, newest first, at most five', () => {
    const names = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
    expect(RECENT_MAX).toBe(5);
    expect(
      quickChoice(state({ privateMessages: messages(names) })).recent,
    ).toEqual(['N1', 'N2', 'N3', 'N4', 'N5']);
    expect(
      quickChoice(state({ privateMessages: messages(['B', 'A']) })).recent,
    ).toEqual(['B', 'A']);
  });

  it('offers no deleted account and no blocked player, and still five others', () => {
    const page = messages(
      [null, 'Bert', 'Cora', 'N3', 'N4', 'N5', 'N6', 'N7'],
      ['Cora', 'Dirk'],
    );
    expect(
      quickChoice(state({ privateMessages: page, friends: friends('u_Dirk') })),
    ).toEqual({ recent: ['Bert', 'N3', 'N4', 'N5', 'N6'], friends: [] });
  });

  it('adds every friend not among the recent, in the order of the buddy list', () => {
    expect(
      quickChoice(
        state({
          privateMessages: messages(['Bert']),
          friends: friends('u_Dirk', 'u_Bert', 'u_Anna'),
        }),
      ),
    ).toEqual({ recent: ['Bert'], friends: ['Dirk', 'Anna'] });
  });

  it('offers a friend beyond the five recent ones among the friends', () => {
    const names = ['N1', 'N2', 'N3', 'N4', 'N5', 'Dirk'];
    expect(
      quickChoice(
        state({ privateMessages: messages(names), friends: friends('u_Dirk') }),
      ).friends,
    ).toEqual(['Dirk']);
  });

  it('leaves out a friend whose account is gone and one with an empty name', () => {
    const s = state({ friends: friends('u_Gone', 'u_Cora', 'u_Empty') });
    s.players['u_Empty'] = { name: '', points: 1 } as never;
    expect(quickChoice(s)).toEqual({ recent: [], friends: ['Cora'] });
  });

  it('is empty without messages and friends (the lock screen, an old state)', () => {
    expect(quickChoice(state())).toEqual({ recent: [], friends: [] });
  });
});

describe('the drafts (owner, 2026-11-22, decision 3)', () => {
  afterEach(forgetDrafts);

  it('starts empty', () => {
    expect(draftOf()).toEqual({ to: '', text: '' });
    expect(draftOf('Bert')).toEqual({ to: '', text: '' });
  });

  it('keeps one draft for „Neue Nachricht“ and one per conversation', () => {
    keepDraft(undefined, { to: 'Bert', text: 'Neu' });
    keepDraft('Bert', { to: '', text: 'Antwort an Bert' });
    keepDraft('Cora', { to: '', text: 'Antwort an Cora' });
    expect(draftOf()).toEqual({ to: 'Bert', text: 'Neu' });
    expect(draftOf('Bert').text).toBe('Antwort an Bert');
    expect(draftOf('Cora').text).toBe('Antwort an Cora');
  });

  it('keeps a copy, so a later change of the object is no draft', () => {
    const typed = { to: 'Bert', text: 'eins' };
    keepDraft(undefined, typed);
    typed.text = 'zwei';
    expect(draftOf().text).toBe('eins');
  });

  it('drops only the draft of the message that went through', () => {
    keepDraft(undefined, { to: 'Bert', text: 'Neu' });
    keepDraft('Bert', { to: '', text: 'Antwort' });
    dropDraft('Bert');
    expect(draftOf('Bert')).toEqual({ to: '', text: '' });
    expect(draftOf().text).toBe('Neu');
    dropDraft();
    expect(draftOf()).toEqual({ to: '', text: '' });
  });

  it('drops every draft at a logout', () => {
    keepDraft(undefined, { to: 'Bert', text: 'Neu' });
    keepDraft('Bert', { to: '', text: 'Antwort' });
    forgetDrafts();
    expect(draftOf().text).toBe('');
    expect(draftOf('Bert').text).toBe('');
  });
});

describe('the count below the text [V]', () => {
  it('is „n / 1000“, the line breaks counted', () => {
    expect(countText('')).toBe('0 / 1000');
    expect(countText('Hallo\nBert')).toBe('10 / 1000');
  });
});

describe('the key that sends (owner, 2026-11-22, decision 2)', () => {
  const key = (over: Partial<KeyboardEvent>) => ({
    key: 'Enter',
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    ...over,
  });

  it('sends on Ctrl+Enter and Cmd+Enter', () => {
    expect(sendsOnKey(key({ ctrlKey: true }))).toBe(true);
    expect(sendsOnKey(key({ metaKey: true }))).toBe(true);
  });

  it('makes a new line on Enter alone, and sends on no other key', () => {
    expect(sendsOnKey(key({}))).toBe(false);
    expect(sendsOnKey(key({ key: 'a', ctrlKey: true }))).toBe(false);
  });

  it('does not send while an input method composes', () => {
    expect(sendsOnKey(key({ ctrlKey: true, isComposing: true }))).toBe(false);
  });
});

describe('the focus when the dialog opens', () => {
  it('goes to the recipient while it is empty, else to the text', () => {
    expect(firstField(false, { to: '', text: 'x' })).toBe('to');
    expect(firstField(false, { to: 'Bert', text: '' })).toBe('text');
  });

  it('goes to the text of a reply', () => {
    expect(firstField(true, { to: '', text: '' })).toBe('text');
  });
});

describe('the reply (owner, 2026-11-22, decision 5)', () => {
  const line = (id: number, mine: boolean): MessageLine => ({
    id,
    mine,
    time: '',
    text: `m${id}`,
    fresh: false,
  });

  it('quotes the last message received, not the own one after it', () => {
    expect(
      lastReceived([line(1, false), line(2, false), line(3, true)])?.text,
    ).toBe('m2');
    expect(lastReceived([line(1, true)])).toBeUndefined();
  });

  it('has the approved texts', () => {
    expect(quoteHeading('Kepler')).toBe('Letzte Nachricht von Kepler');
    expect(PM_DIALOG_LABELS).toEqual({
      recent: 'Zuletzt geschrieben:',
      friends: 'Freunde:',
      cancel: 'Abbrechen',
      to: 'An',
    });
  });
});
