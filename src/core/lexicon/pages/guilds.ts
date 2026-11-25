// The rule page „Gilden“ (#288): joining, the ranks with their rights and
// limits, and the chat. The numbers come from `src/core/guild-ranks.ts` and
// `guild-chat.ts`; the words are a draft of Claude for the owner to check
// ([V], #288).
import {
  CHAT_HISTORY,
  CHAT_INTERVAL,
  guildsOn,
  MAX_CHAT_TEXT,
} from '../../guild-chat.ts';
import {
  GUILD_RIGHTS,
  MAX_GUILD_RANKS,
  MAX_RANK_NAME,
  MEMBER_RIGHTS,
  MIN_RANK_NAME,
  RIGHT_TEXT,
} from '../../guild-ranks.ts';
import { ROUND_SETTINGS } from '../../round.ts';
import { facts, number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

const basicsSection = (s: LexState): PageSection =>
  section(
    'basics',
    'Beitreten und Mitglieder',
    say(
      'Du kannst in einer Gilde sein oder eine offene Bewerbung haben, aber nicht beides. Wer eine Gilde gründet, ist ihre Leitung; wer sich bewirbt, wird aufgenommen, wenn jemand mit dem Recht dazu zustimmt. Mitglieder einer Gilde dürfen beieinander Wache halten, soweit die Runde es erlaubt ([[mission-hold]]). Wird ein Mitglied angegriffen oder trifft ein Mondbruch seinen Mond, erscheint beim Start des Angriffs ein Ereignis im Chat seiner Gilde. Wer die Leitung hat, kann nicht austreten, solange es andere Mitglieder gibt: Er gibt zuerst die Leitung weiter oder löst die Gilde auf.',
    ),
    facts([['Gilden in dieser Runde', s.round.guilds ? 'ja' : 'nein']]),
  );

const ranksSection = (): PageSection =>
  section(
    'ranks',
    'Ränge und Rechte',
    say(
      'Jedes Mitglied hat einen Rang, und jeder Rang hat eine Reihe von Rechten. Eine neue Gilde beginnt mit zwei Rängen, der Leitung und dem Rang Mitglied; was darüber hinausgeht, richtet die Leitung ein oder ein Rang, der das Recht dazu hat. Es gibt genau eine Leitung, und sie hat alle Rechte. Nur die Leitung löst die Gilde auf, gibt die Leitung weiter und wählt den Rang, den neue Mitglieder bekommen.',
    ),
    table(
      'Die Rechte eines Rangs',
      ['Recht', 'Neue Mitglieder haben es'],
      GUILD_RIGHTS.map((right) => [
        RIGHT_TEXT[right],
        MEMBER_RIGHTS.includes(right) ? 'ja' : 'nein',
      ]),
    ),
    say(
      'Die Ränge sind geordnet: Ein Mitglied wirkt nur auf Mitglieder eines niedrigeren Rangs, und es vergibt nur Ränge und Rechte, die es selbst hat. Eine Gilde hat höchstens {ranks} Ränge, die Leitung eingerechnet. Ein Rangname braucht {min} bis {name} Zeichen und kommt in der Gilde nur einmal vor, ob groß oder klein geschrieben.',
      {
        ranks: number(MAX_GUILD_RANKS),
        min: number(MIN_RANK_NAME),
        name: number(MAX_RANK_NAME),
      },
    ),
  );

/** Who may hold in this round, as the setting names it: guild, friends or both. */
const holdersOf = (s: LexState): string => {
  const setting = ROUND_SETTINGS.find((x) => x.name === 'allies');
  const choices = setting?.kind === 'number' ? setting.choices : undefined;
  return choices?.find((c) => c.value === s.round.allies)?.label ?? '–';
};

const friendsSection = (s: LexState): PageSection =>
  section(
    'friends',
    'Freunde',
    say(
      'Neben der Gilde gibt es Freunde. Eine Freundschaft entsteht erst, wenn die Anfrage angenommen ist; du kannst eine Anfrage stellen, eine erhaltene annehmen oder ablehnen, deine eigene zurückziehen und eine Freundschaft beenden. Hat dich jemand schon angefragt, kannst du ihn nicht noch einmal anfragen: Nimm seine Anfrage an. Freunde sehen einander online oder offline, und alle Freundschaften und Anfragen bleiben in einer neuen Runde erhalten. Wer bei wem Wache halten darf, legt der Admin je Runde fest: Gilde, Freunde oder beides.',
    ),
    facts([['Wache halten dürfen in dieser Runde', holdersOf(s)]]),
  );

const chatSection = (): PageSection =>
  section(
    'chat',
    'Der Chat',
    say(
      'Der Gildenchat zeigt die Nachrichten der Mitglieder und die Ereignisse der Gilde. Lesen, schreiben und löschen sind eigene Rechte. Eine Nachricht darf höchstens {length} Zeichen lang sein, und jedes Mitglied darf nur alle {interval} Sekunden eine schreiben. Der Chat behält die letzten {history} Einträge, die Ereignisse eingerechnet. Eine neue Runde leert alle Chats.',
      {
        length: number(MAX_CHAT_TEXT),
        interval: number(CHAT_INTERVAL / 1000),
        history: number(CHAT_HISTORY),
      },
    ),
  );

export const page: PageDef = {
  id: 'rule-guilds',
  // Hidden in a round without guilds, as its view (#404).
  offered: guildsOn,
  kind: 'rule',
  title: 'Gilden',
  line: 'Wie eine Gilde beitritt und arbeitet, welche Ränge und Rechte es gibt, was der Chat erlaubt und wie Freundschaften entstehen.',
  keywords: ['Gilde', 'Rang', 'Rechte', 'Leitung', 'Chat'],
  seeAlso: ['mission-hold', 'rule-universe', 'faq-defend'],
  sections: (s) => [
    basicsSection(s),
    ranksSection(),
    chatSection(),
    friendsSection(s),
  ],
};
