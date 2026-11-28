import { describe, expect, it } from 'vitest';
import { PUSH_TOPICS } from '../../core/push.ts';
import type { PushTopic } from '../../core/push.ts';
import {
  pushKinds,
  pushKindsHTML,
  pushSaver,
  shownPushOff,
  type PushChoice,
} from './push-options.ts';

/** The box on a server with Web Push. */
const pushOptionsHTML = (off: readonly string[] | undefined): string =>
  pushKindsHTML(true, off, true);

const boxes = (html: string): string[] => html.match(/<input [^>]*>/g) ?? [];

describe('push options in „Hilfe & Optionen“ (#192)', () => {
  it('shows one checkbox per kind with its German name, all on by default', () => {
    const html = pushOptionsHTML([]);
    expect(html).toMatch(
      /^<p>Gilt für alle deine Geräte mit aktivierten Browser-Benachrichtigungen\. Eine Änderung wird sofort gespeichert\.<\/p><fieldset class="push-kinds"><legend>Welche Meldungen per Push kommen<\/legend><label class="switch">/,
    );
    expect(boxes(html)).toEqual(
      PUSH_TOPICS.map(
        (t) =>
          `<input type="checkbox" id="push_${t}" data-chg="push" data-k="${t}" checked>`,
      ),
    );
    expect(html).toContain('> Gebäude fertig</label>');
    expect(html).toContain('> Sturmangriff auf deine Planeten</label>');
    expect(html).toContain('> Nachrichten im Gilden-Chat</label>');
    expect(html.match(/<\/label>/g)).toHaveLength(PUSH_TOPICS.length);
    expect(html.match(/<\/label><label class="switch">/g)).toHaveLength(
      PUSH_TOPICS.length - 1,
    );
    expect(html).toMatch(/<\/label><\/fieldset>$/);
    expect(html).not.toContain('undefined');
    expect(pushOptionsHTML(undefined)).toBe(html);
  });

  it('is hidden on a server without Web Push (owner, 2026-11-14)', () => {
    expect(pushKindsHTML(false, [], true)).toBe('');
    expect(pushKindsHTML(undefined, ['news'], false)).toBe('');
  });

  it('shows on a server with Web Push', () => {
    expect(pushKindsHTML(true, [], true)).toContain(
      '<fieldset class="push-kinds">',
    );
  });

  it('hides the two kinds of the guild chat while guilds are off (#169; owner, 2026-11-15)', () => {
    const off = pushKindsHTML(true, ['news', 'guild-chat'], false);
    expect(boxes(off)).toEqual(
      PUSH_TOPICS.filter((t) => !t.startsWith('guild-')).map(
        (t) =>
          `<input type="checkbox" id="push_${t}" data-chg="push" data-k="${t}"${t === 'news' ? '' : ' checked'}>`,
      ),
    );
    expect(off).not.toContain('Gildenereignisse');
    expect(off).not.toContain('Nachrichten im Gilden-Chat');
    const on = pushKindsHTML(true, ['guild-chat'], true);
    expect(on).toContain(
      '<input type="checkbox" id="push_guild-events" data-chg="push" data-k="guild-events" checked> Gildenereignisse</label>',
    );
    expect(on).toContain(
      '<input type="checkbox" id="push_guild-chat" data-chg="push" data-k="guild-chat"> Nachrichten im Gilden-Chat</label>',
    );
  });

  it('names every kind ([E], owner 2026-11-14)', () => {
    const names = [...pushOptionsHTML([]).matchAll(/> ([^<]+)<\/label>/g)].map(
      (m) => m[1],
    );
    expect(names).toEqual([
      'Gebäude fertig',
      'Forschung abgeschlossen',
      'Auftrag der Schiffsschmiede abgeschlossen',
      'Eigene Flotten: Ankunft, Bericht und Rückkehr',
      'Sturmangriff auf deine Planeten',
      'Auspex-Aktivität bei deinen Planeten',
      'Lieferung eines anderen Spielers',
      // Reports of a hold to its host and its owner (#440, 243b).
      'Wachen',
      'Servernachrichten',
      'Neue Version',
      'Gildenereignisse',
      'Nachrichten im Gilden-Chat',
      'Persönliche Nachrichten',
    ]);
  });

  it('leaves the kinds that are off unchecked', () => {
    const html = pushOptionsHTML(['news', 'guild-chat']);
    expect(boxes(html).filter((b) => !b.includes('checked'))).toEqual([
      '<input type="checkbox" id="push_news" data-chg="push" data-k="news">',
      '<input type="checkbox" id="push_guild-chat" data-chg="push" data-k="guild-chat">',
    ]);
  });
});

/** A save the test answers by hand, as a slow server would. */
function slowServer() {
  const calls: { off: PushTopic[]; answer: (ok: boolean) => void }[] = [];
  const save = (off: PushTopic[]): Promise<boolean> =>
    new Promise((resolve) => calls.push({ off, answer: resolve }));
  /** Lets the saver go on after an answer. */
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { calls, save, settle };
}

describe('the checkboxes of the push kinds as data (#118, bundle 5)', () => {
  it('has none on a server without Web Push', () => {
    expect(pushKinds(false, [], true)).toBeNull();
    expect(pushKinds(undefined, ['news'], false)).toBeNull();
  });

  it('lists every kind with the id of its input, on unless the player switched it off', () => {
    const kinds = pushKinds(true, ['news'], true)!;
    expect(kinds.map((k) => k.topic)).toEqual([...PUSH_TOPICS]);
    expect(kinds.find((k) => k.topic === 'fleet')).toEqual({
      topic: 'fleet',
      id: 'push_fleet',
      label: 'Eigene Flotten: Ankunft, Bericht und Rückkehr',
      checked: true,
    });
    expect(kinds.filter((k) => !k.checked).map((k) => k.topic)).toEqual([
      'news',
    ]);
    expect(pushKinds(true, undefined, true)!.every((k) => k.checked)).toBe(
      true,
    );
  });

  it('leaves out the kinds of the guilds while guilds are off', () => {
    expect(pushKinds(true, [], false)!.map((k) => k.topic)).not.toContain(
      'guild-chat',
    );
  });
});

describe('saving the push kinds one at a time (CodeRabbit on #204)', () => {
  it('keeps both kinds off after two quick changes; the second waits for the first', async () => {
    const { calls, save, settle } = slowServer();
    const choice: PushChoice = {};
    const change = pushSaver(choice, save);
    const first = change([], 'news', false);
    const second = change([], 'fleet', false);
    expect(second).toBe(first);
    expect(calls.map((c) => c.off)).toEqual([['news']]);
    // Meanwhile the page shows both off, whatever the first answer says.
    expect(shownPushOff(choice, ['news'])).toEqual(['fleet', 'news']);
    calls[0]!.answer(true);
    await settle();
    expect(calls.map((c) => c.off)).toEqual([['news'], ['fleet', 'news']]);
    expect(shownPushOff(choice, ['news'])).toEqual(['fleet', 'news']);
    calls[1]!.answer(true);
    await first;
    expect(calls).toHaveLength(2);
    expect(choice.pushChoice).toBeUndefined();
    expect(shownPushOff(choice, ['fleet', 'news'])).toEqual(['fleet', 'news']);
  });

  it('sends only the newest choice after the running save', async () => {
    const { calls, save, settle } = slowServer();
    const choice: PushChoice = {};
    const change = pushSaver(choice, save);
    const done = change(['spied'], 'news', false);
    void change(['spied'], 'fleet', false);
    void change(['spied'], 'spied', true);
    void change(['spied'], 'news', true);
    calls[0]!.answer(true);
    await settle();
    expect(calls.map((c) => c.off)).toEqual([['spied', 'news'], ['fleet']]);
    calls[1]!.answer(true);
    await done;
    expect(calls).toHaveLength(2);
  });

  it('starts a new save after the last one ended', async () => {
    const { calls, save } = slowServer();
    const choice: PushChoice = {};
    const change = pushSaver(choice, save);
    const one = change([], 'news', false);
    calls[0]!.answer(true);
    await one;
    const two = change(['news'], 'research', false);
    expect(two).not.toBe(one);
    expect(calls.map((c) => c.off)).toEqual([['news'], ['research', 'news']]);
    calls[1]!.answer(true);
    await two;
  });

  it('shows the server kinds again after a failed save, unless a newer choice waits', async () => {
    const { calls, save, settle } = slowServer();
    const choice: PushChoice = {};
    const change = pushSaver(choice, save);
    const failed = change(['news'], 'fleet', false);
    calls[0]!.answer(false);
    await failed;
    expect(calls).toHaveLength(1);
    expect(choice.pushChoice).toBeUndefined();
    expect(shownPushOff(choice, ['news'])).toEqual(['news']);

    const retried = change(['news'], 'fleet', false);
    void change(['news'], 'research', false);
    calls[1]!.answer(false);
    await settle();
    expect(calls.map((c) => c.off)).toEqual([
      ['fleet', 'news'],
      ['fleet', 'news'],
      ['research', 'fleet', 'news'],
    ]);
    calls[2]!.answer(true);
    await retried;
    expect(choice.pushChoice).toBeUndefined();
  });

  it('ignores a change of an unknown kind', async () => {
    const { calls, save } = slowServer();
    const choice: PushChoice = {};
    await pushSaver(choice, save)([], 'messages', false);
    expect(calls).toEqual([]);
    expect(choice.pushChoice).toBeUndefined();
  });
});
