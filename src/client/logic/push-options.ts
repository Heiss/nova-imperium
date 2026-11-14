// The push kinds in „Hilfe & Optionen“ (issue #192): one checkbox per kind,
// for all devices of the account. A change saves at once.
import { isPushTopic, PUSH_TOPICS, type PushTopic } from '../../core/push.ts';

/** The names of the kinds ([E], owner, 2026-11-14). */
const LABELS: Record<PushTopic, string> = {
  buildings: 'Gebäude fertig',
  research: 'Forschung abgeschlossen',
  shipyard: 'Auftrag der Schiffsschmiede abgeschlossen',
  fleet: 'Eigene Flotten: Ankunft, Bericht und Rückkehr',
  attacked: 'Sturmangriff auf deine Planeten',
  spied: 'Auspex-Aktivität bei deinen Planeten',
  delivery: 'Lieferung eines anderen Spielers',
  announcement: 'Servernachrichten',
  news: 'Neue Version',
  'guild-events': 'Gildenereignisse',
  'guild-chat': 'Nachrichten im Gilden-Chat',
};

const inputId = (t: PushTopic): string => `push_${t}`;

/** One checkbox per kind; a kind is on unless the player switched it off. */
function pushOptionsHTML(off: readonly string[] | undefined): string {
  const boxes = PUSH_TOPICS.map(
    (t) =>
      `<label class="switch"><input type="checkbox" id="${inputId(t)}" data-chg="push" data-k="${t}"${off?.includes(t) ? '' : ' checked'}> ${LABELS[t]}</label>`,
  );
  return `<fieldset class="push-kinds"><legend>Welche Meldungen per Push kommen</legend>${boxes.join('')}</fieldset>`;
}

/**
 * The content of the box „Benachrichtigungen“, or nothing on a server
 * without Web Push (owner, 2026-11-14).
 */
export const pushKindsHTML = (
  webPush: boolean | undefined,
  off: readonly string[] | undefined,
): string =>
  webPush === true
    ? `<p>Gilt für alle deine Geräte mit aktivierten Browser-Benachrichtigungen. Eine Änderung wird sofort gespeichert.</p>${pushOptionsHTML(off)}`
    : '';

/** Where the player's latest choice waits until the server has it. */
export interface PushChoice {
  /** The kinds the player wants off while a save runs; else none. */
  pushChoice?: PushTopic[];
}

/** The kinds to show as off: the player's pending choice, else the server's. */
export const shownPushOff = (
  choice: PushChoice,
  server: readonly string[] | undefined,
): readonly string[] | undefined => choice.pushChoice ?? server;

/**
 * Saves the push kinds one request at a time (CodeRabbit on #204): a change
 * updates the choice outside the page at once, and the newest choice is
 * sent when the running save returns, so an older answer never undoes a
 * newer click. When the last save returns, saved or failed, the page shows
 * the server's kinds again. Returns the function for a change of one
 * checkbox, which resolves when no save runs any more.
 */
export function pushSaver(
  choice: PushChoice,
  save: (off: PushTopic[]) => Promise<unknown>,
): (server: readonly string[], topic: unknown, on: boolean) => Promise<void> {
  let running: Promise<void> | null = null;
  const run = async (): Promise<void> => {
    let sent: PushTopic[] | undefined;
    while (choice.pushChoice !== sent) {
      sent = choice.pushChoice!;
      // A failed save shows its toast; a newer choice is still sent.
      await save(sent);
    }
    // Saved or failed: the page shows the server's kinds again.
    choice.pushChoice = undefined;
    running = null;
  };
  return (server, topic, on) => {
    if (!isPushTopic(topic)) return Promise.resolve();
    const off = new Set(shownPushOff(choice, server));
    if (on) off.delete(topic);
    else off.add(topic);
    choice.pushChoice = PUSH_TOPICS.filter((t) => off.has(t));
    running ??= run();
    return running;
  };
}
