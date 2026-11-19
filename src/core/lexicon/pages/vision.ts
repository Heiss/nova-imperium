// The rule page „Sichtbarkeit und Aktivität“ (#288): what you see of foreign
// fleets (#228), the activity markers of planets and accounts (#229) and the
// estimated play time (#231, #232). The numbers come from
// `src/core/fleet-recognition.ts`, `activity.ts` and the round; the words are
// a draft of Claude for the owner to check ([V], #288).
import {
  activityLimits,
  inactivity,
  DAY_MS,
  MINUTE_MS,
  planetActivity,
} from '../../activity.ts';
import { recognitionOf, seenShips } from '../../fleet-recognition.ts';
import { days, minutes, number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

const AGES = [0, 10, 14, 15, 30, 59, 60, 90];

/** The ships a foreign fleet of the example has. */
const FLEET = { sc: 3, lf: 12 };

const fleetsSection = (s: LexState): PageSection => {
  const recognition = recognitionOf(s.round);
  return section(
    'fleets',
    'Fremde Flotten',
    say(
      'Wie viel du von einer fremden Flotte siehst, die zu deinen Planeten fliegt, hängt von deiner [[spy|Auspex-Lehre]] ab. Ab Stufe {total} siehst du die Zahl der Schiffe, ab Stufe {types} auch die Schiffsarten, ab Stufe {counts} die genaue Zahl je Art. Jede Grenze gilt für sich. Der Server schickt nur, was du siehst, und die Ladung bleibt immer verborgen. Die Grenzen gelten für jede fremde Flotte und legt der Admin für die Runde fest.',
      {
        total: number(recognition.total),
        types: number(recognition.types),
        counts: number(recognition.counts),
      },
    ),
    table(
      'Was du bei einer fremden Flotte siehst',
      [
        'Deine Auspex-Lehre',
        'Schiffe insgesamt',
        'Schiffsarten',
        'Genaue Zahl je Art',
      ],
      [0, recognition.total, recognition.types, recognition.counts]
        .filter((level, i, all) => all.indexOf(level) === i)
        .sort((a, b) => a - b)
        .map((level) => {
          const seen = seenShips(FLEET, level, recognition);
          return [
            level,
            seen.total === undefined ? 'unbekannt' : number(seen.total),
            seen.types ? number(seen.types.length) : 'unbekannt',
            seen.ships ? 'ja' : 'nein',
          ];
        }),
    ),
    say(
      'Das Beispiel ist eine Flotte mit {ships} Schiffen in {kinds} Arten. Eigene Flotten siehst du immer ganz.',
      {
        ships: number(Object.values(FLEET).reduce((a, b) => a + b, 0)),
        kinds: number(Object.keys(FLEET).length),
      },
    ),
  );
};

const activitySection = (s: LexState): PageSection => {
  const limits = activityLimits(s.round);
  return section(
    'activity',
    'Aktivität',
    say(
      'Auf der Sternenkarte und im Bericht einer [[rule-spy|Auspex-Erkundung]] siehst du, wann ein Planet zuletzt aktiv war. Aktivität setzt, wer sich anmeldet (dann nur auf seinem Hauptplaneten) oder im Spiel etwas tut (dann auf allen Planeten und Monden). Flotten, Erkundungen und fertige Gebäude setzen keine. In den ersten {recent} nach der Aktivität steht nur, dass der Planet aktiv ist. Danach zeigt die Karte, wie viele Minuten es her ist, bis höchstens {limit}; später steht nichts mehr.',
      {
        recent: minutes(limits.recent),
        limit: minutes(limits.minutes),
      },
    ),
    table(
      'Was die Sternenkarte nach der Aktivität zeigt',
      ['Minuten seit der Aktivität', 'Anzeige'],
      AGES.map((age) => {
        const shown = planetActivity(0, age * MINUTE_MS, limits);
        return [
          age,
          shown === null
            ? 'keine Anzeige'
            : 'recent' in shown
              ? 'Aktiv'
              : `Aktivität vor ${minutes(shown.minutes)}`,
        ];
      }),
    ),
  );
};

const inactivitySection = (s: LexState): PageSection => {
  const limits = activityLimits(s.round);
  return section(
    'inactivity',
    'Inaktive Spieler',
    say(
      'Auch ein Spieler zeigt, wenn er lange nichts getan hat: Wer {inactive} nichts getan hat, gilt als inaktiv, wer {long} nichts getan hat, als lange inaktiv. Die Werte legt der Admin für die Runde fest.',
      {
        inactive: days(limits.inactive),
        long: days(limits.longInactive),
      },
    ),
    table(
      'Wann ein Spieler inaktiv heißt',
      ['Tage ohne Aktivität', 'Anzeige'],
      [
        0,
        limits.inactive - 1,
        limits.inactive,
        limits.longInactive - 1,
        limits.longInactive,
      ]
        .filter((d, i, all) => d >= 0 && all.indexOf(d) === i)
        .map((d) => {
          const state = inactivity(0, d * DAY_MS, limits);
          return [
            d,
            state === 'long'
              ? 'Lange inaktiv'
              : state === 'inactive'
                ? 'Inaktiv'
                : 'keine Anzeige',
          ];
        }),
    ),
  );
};

const playtimeSection = (): PageSection =>
  section(
    'playtime',
    'Deine Spielzeit',
    say(
      'Unter Optionen siehst du, wie viel du gespielt hast: eine Schätzung der aktiven Zeit, nur für dich, für heute, die letzten sieben Tage und die Runde. Aktiv zählt die Zeit, in der die Seite sichtbar im Vordergrund ist und du gerade etwas getan hast: geklickt, getippt oder gescrollt. Nach einer Minute ohne Eingabe und wenn du die Seite verlässt, pausiert die Zählung; kurze Lesepausen zählen mit. Die Tage werden nach UTC gezählt.',
    ),
  );

export const page: PageDef = {
  id: 'rule-vision',
  kind: 'rule',
  title: 'Sichtbarkeit und Aktivität',
  line: 'Was du von fremden Flotten siehst und woran du erkennst, ob ein Spieler aktiv ist.',
  keywords: ['sichtbar', 'erkennen', 'Aktivität', 'inaktiv', 'Spielzeit'],
  seeAlso: ['spy', 'rule-spy', 'faq-intel'],
  sections: (s) => [
    fleetsSection(s),
    activitySection(s),
    inactivitySection(s),
    playtimeSection(),
  ],
};
