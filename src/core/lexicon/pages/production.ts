// The rule page „Produktion, Energie und Lager“ (#288): the base income, the
// energy factor of the mines, the storage limit and what throttles a
// producer. The numbers come from `src/core/economy.ts` and the components of
// the entries; the words are a draft of Claude for the owner to check ([V],
// #288).
import { BASE_INCOME } from '../../components/produces.ts';
import { prod } from '../../economy.ts';
import { nameOf, number, percent, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

const MINES = [5, 10, 15, 20];
const POWER = [5, 10, 15, 20];

const incomeSection = (s: LexState): PageSection =>
  section(
    'income',
    'Was ein Planet fördert',
    say(
      'Jeder Planet fördert von selbst eine Grundmenge je Stunde, auch ohne Gebäude: {metal} Adamant und {crystal} Psikristall, mit dem Tempo des Universums malgenommen. Dazu kommt die Förderung der Gebäude. Ein Mond fördert nichts. Im Urlaubsmodus ruht die Förderung.',
      {
        metal: number(BASE_INCOME.m * s.u.speed),
        crystal: number(BASE_INCOME.c * s.u.speed),
      },
    ),
  );

const energySection = (s: LexState): PageSection =>
  section(
    'energy',
    'Energie',
    say(
      'Die Förderstätten brauchen Energie, und zwar mehr, je höher ihre Stufe ist. Reicht die erzeugte Energie des Planeten nicht für alle, fördern alle im selben Verhältnis weniger: Das ist der Energiefaktor. Er ist nie größer als eins, mehr Energie als nötig bringt also keine zusätzliche Förderung. Energie liefern die [[solar|Sonnenkathedrale]], das [[fusion|Fusionssanktum]] und die [[sat|Sonnenreliquiare]]. Die Tabelle zeigt den Energiefaktor eines Planeten mit nur diesen beiden Gebäuden.',
    ),
    table(
      `Energiefaktor mit ${nameOf('metal')} und ${nameOf('solar')}`,
      [
        `${nameOf('metal')} Stufe`,
        ...POWER.map((l) => `${nameOf('solar')} Stufe ${l}`),
      ],
      MINES.map((mine) => [
        mine,
        ...POWER.map((power) =>
          percent(
            prod({ b: { metal: mine, solar: power }, pct: {}, temp: 50 }, s.u)
              .f,
          ),
        ),
      ]),
    ),
    say(
      'Ist der Vorrat eines Rohstoffs leer und würde weiter sinken, weil ein Gebäude ihn verbraucht, läuft dieses Gebäude gedrosselt, und zwar genau so, dass der Vorrat bei null bleibt. Den Anteil, mit dem ein Gebäude läuft, kannst du auch selbst einstellen; er senkt Förderung und Verbrauch entsprechend.',
    ),
  );

const storageSection = (s: LexState): PageSection =>
  section(
    'storage',
    'Lager',
    say(
      'Die Förderung endet, sobald das Lager eines Rohstoffs voll ist; was darüber liegt, etwa nach einer Lieferung, bleibt liegen und sinkt nur durch Verbrauch. Ohne Ausbau fasst das Lager {base} je Rohstoff. Die drei Lager ([[smetal]], [[scrystal]] und [[sdeut]]) vergrößern es stufenweise.',
      { base: number(s.u.baseStore) },
    ),
  );

export const page: PageDef = {
  id: 'rule-production',
  kind: 'rule',
  title: 'Produktion, Energie und Lager',
  line: 'Was ein Planet fördert, warum eine Mine weniger bringt als angegeben und wo die Förderung endet.',
  keywords: ['Förderung', 'Energie', 'Energiemangel', 'Lager', 'Produktion'],
  seeAlso: ['metal', 'solar', 'fusion', 'sat', 'smetal', 'faq-mine'],
  sections: (s) => [incomeSection(s), energySection(s), storageSection(s)],
};
