// The text of the lines of a guild chat, exactly (#169, #118 bundle 6): the
// E2E suite reads an <li> with a pattern that ends in $ ("… beigetreten.$",
// "…, Ankunft 22:59$"), so a space at the end of a line is a failure. The
// comparison with the markup of the old view (normalize() of markup.ts) drops
// the white space next to a block tag and could not see the one a line of
// ChatLog.svelte gained between two {#if} blocks; these tests read the text
// as it is.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { dt } from '../logic/format.ts';
import { chatLog } from '../logic/guilds.ts';
import type { GuildChatMessage } from '../logic/types.ts';
import { textContents } from '../../test/markup.ts';
import ChatLog from './ChatLog.svelte';

const TIME = new Date(2026, 10, 15, 19, 40, 5).getTime();

const message = (over: Partial<GuildChatMessage> = {}): GuildChatMessage => ({
  id: 1,
  time: TIME,
  kind: 'message',
  name: 'Lea',
  text: 'Hallo',
  delete: false,
  ...over,
});

/** The exact text of each line (`li`) of the log, the white space of a template as one space. */
function lines(
  messages: GuildChatMessage[],
  deletable = false,
): { texts: string[]; html: string } {
  const html = render(ChatLog, {
    props: { log: chatLog(messages, deletable) },
  }).body;
  return {
    texts: textContents(html)
      .filter((t) => t.startsWith('li:'))
      .map((t) => t.slice('li: '.length)),
    html,
  };
}

describe('the text of a chat line', () => {
  const time = dt(TIME);

  it('is the author, the time and the text, with no space at its end', () => {
    expect(lines([message()]).texts).toEqual([`Lea ${time}Hallo`]);
  });

  it('names a former member in italics, as before', () => {
    const { texts, html } = lines([message({ name: null })]);
    expect(texts).toEqual([`ehemaliges Mitglied ${time}Hallo`]);
    expect(html).toContain('<i>ehemaliges Mitglied</i>');
  });

  it('is the time and the sentence for an event, with no space at its end', () => {
    expect(
      lines([message({ kind: 'join', name: 'Anna', text: '' })]).texts,
    ).toEqual([`${time}Anna ist der Gilde beigetreten.`]);
  });

  it('is the sentence with the arrival for an attack, with no space at its end', () => {
    const arrival = new Date(2026, 10, 15, 20, 15).getTime();
    const [line] = lines([
      message({
        kind: 'attack',
        name: 'Anna',
        text: '[9:29:5]',
        attacker: 'Vex',
        arrival,
      }),
    ]).texts;
    expect(line).toMatch(
      /^[^⚔]*⚔ Angriff auf \[9:29:5\] \(Vex → Anna\), Ankunft \d\d:\d\d$/,
    );
  });

  it('ends in one space and the button where the rank may delete the message', () => {
    expect(
      lines([message({ delete: true }), message({ id: 2 })], true).texts,
    ).toEqual([`Lea ${time}Hallo Löschen`, `Lea ${time}Hallo`]);
  });

  it('has no button in the log of the admin', () => {
    expect(lines([message({ delete: true })]).texts).toEqual([
      `Lea ${time}Hallo`,
    ]);
  });

  it('shows the characters of markup in a message as text', () => {
    expect(lines([message({ text: 'a <b> & c' })]).texts).toEqual([
      `Lea ${time}a <b> & c`,
    ]);
  });
});
