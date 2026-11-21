// „Meine Aktivität & Spielzeit“ in „Hilfe & Optionen“ (#231,
// okf/features/own-activity.md): the words and the markup of the box. The
// numbers come from the server, derived from the accepted intervals; nothing
// here counts.
import type { OwnActivity } from '../../core/playtime.ts';
import { esc } from './format.ts';

/** The explanation of the method (#232, #231) [V]. */
export const OWN_ACTIVITY_HELP =
  'Gezählt wird die geschätzte Zeit mit aktiver Nutzung. Nach 60 Sekunden ohne Eingabe oder Scrollen sowie beim Verlassen des aktiven Fensters pausiert die Erfassung. Kurze Lesepausen zählen mit.';

/**
 * What the box shows while the numbers are on their way and when they fail
 * [V]. The component Options (#118, bundle 5) holds the box with its
 * `#own-activity` as a plain element, which features/playtime.ts fills after
 * the render.
 */
export const OWN_ACTIVITY_LOADING = 'Wird geladen …';
export const OWN_ACTIVITY_FAILED = 'Die Angaben sind gerade nicht erreichbar.';

const two = (n: number): string => String(n).padStart(2, '0');

/** A UTC day as „TT.MM.JJJJ“. */
export function utcDate(t: number): string {
  const d = new Date(t);
  return `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** A moment in UTC as „TT.MM.JJJJ, HH:MM UTC“. */
export const utcMoment = (t: number): string => {
  const d = new Date(t);
  return `${utcDate(t)}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
};

/**
 * A duration in whole minutes: „12 Min.“, from an hour „1 Std. 05 Min.“;
 * less than half a minute reads „unter 1 Min.“, none „0 Min.“.
 */
export function playtime(ms: number): string {
  if (ms <= 0) return '0 Min.';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'unter 1 Min.';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} Std. ${two(minutes % 60)} Min.` : `${minutes} Min.`;
}

const row = (label: string, value: string): string =>
  `<tr><td>${label}</td><td>${esc(value)}</td></tr>`;

/** The tables and the explanation, from the server's answer. */
export function ownActivityHTML(a: OwnActivity): string {
  const week = a.days.reduce((sum, d) => sum + d.activeMs, 0);
  const days = a.days
    .map(
      (d, i) =>
        `<tr><td>${i === 0 ? 'Heute' : utcDate(d.day)}</td><td>${esc(playtime(d.activeMs))}</td><td>${d.actions}</td></tr>`,
    )
    .join('');
  const since =
    a.since === null
      ? 'Die Erfassung beginnt mit deiner nächsten Eingabe.'
      : `Erfasst seit ${utcMoment(a.since)}. Frühere Schätzungen wurden anders berechnet und sind nicht enthalten.`;
  return `<p>${OWN_ACTIVITY_HELP}</p>
<table><caption class="dim">Geschätzte aktive Spielzeit</caption><tbody>
${row('Heute (UTC)', playtime(a.days[0]?.activeMs ?? 0))}
${row('Letzte 7 Tage (UTC)', playtime(week))}
${row('Diese Runde', playtime(a.roundMs))}
${row('Alle Runden', playtime(a.totalMs))}
${row('Zuletzt aktiv', a.last === null ? '—' : utcMoment(a.last))}
</tbody></table>
<table><thead><tr><th scope="col">Tag (UTC)</th><th scope="col">Geschätzte aktive Spielzeit</th><th scope="col">Spielaktionen</th></tr></thead><tbody>${days}</tbody></table>
<p class="dim">${esc(since)} Alle Angaben sind Schätzungen; während der Runde siehst nur du sie.</p>`;
}
