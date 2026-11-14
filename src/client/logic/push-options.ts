// The push kinds in „Hilfe & Optionen“ (issue #192): one checkbox per kind,
// for all devices of the account. A change saves at once.
import { PUSH_TOPICS, type PushTopic } from '../../core/push.ts';

/** The names of the kinds ([V], confirmed by the owner in the pull request). */
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
export function pushOptionsHTML(off: readonly string[] | undefined): string {
  const boxes = PUSH_TOPICS.map(
    (t) =>
      `<label class="switch"><input type="checkbox" id="${inputId(t)}" data-chg="push"${off?.includes(t) ? '' : ' checked'}> ${LABELS[t]}</label>`,
  );
  return `<fieldset class="push-kinds"><legend>Welche Meldungen per Push kommen</legend>${boxes.join('')}</fieldset>`;
}

/** The kinds that are off, read from the checkboxes (a missing one counts as on). */
export const pushOffOf = (
  checked: (id: string) => boolean | undefined,
): PushTopic[] => PUSH_TOPICS.filter((t) => checked(inputId(t)) === false);
