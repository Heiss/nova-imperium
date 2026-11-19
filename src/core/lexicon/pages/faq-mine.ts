// The question „Warum fördert meine Mine weniger als angegeben?“ (#288): the
// reasons, and what the shown planet says about them. The numbers come from
// `src/core/economy.ts`; the words are a draft of Claude for the owner to
// check ([V], #288).
import { caps, prod } from '../../economy.ts';
import { facts, number, percent, say, section } from '../say.ts';
import type { Block, PageDef } from '../types.ts';

const NAMES = { m: 'Adamant', c: 'Psikristall', d: 'Promethium' } as const;

export const page: PageDef = {
  id: 'faq-mine',
  kind: 'question',
  title: 'Warum fördert meine Mine weniger als angegeben?',
  line: 'Meist fehlt Energie; es kann auch am Lager, am Anteil oder an der Temperatur liegen.',
  keywords: ['Mine', 'Förderung', 'weniger', 'Energiemangel', 'Lager'],
  seeAlso: ['rule-production', 'solar', 'fusion', 'sat', 'metal'],
  sections: (s) => {
    const own = s.own;
    const stand: Block[] = [];
    if (own) {
      const p = prod(own.planet, s.u, s.research);
      const full = (['m', 'c', 'd'] as const)
        .filter((k) => own.planet.res[k] >= caps(own.planet, s.u)[k])
        .map((k) => NAMES[k]);
      stand.push({
        t: 'stand',
        text: `Dein Stand auf diesem Planeten: Die Energie reicht für ${percent(p.f)} der Förderung (erzeugt ${number(Math.round(p.eProd))}, gebraucht ${number(Math.round(p.eUse))}).${full.length ? ` Voll ist das Lager von ${full.join(', ')}.` : ' Kein Lager ist voll.'}`,
      });
    }
    return [
      section(
        'answer',
        'Kurz gesagt',
        say(
          'Die Zahlen in den Listen nennen die Förderung bei voller Energie. Was wirklich ankommt, hängt von diesen Dingen ab:',
        ),
        facts([
          [
            'Energie',
            'Reicht die Energie des Planeten nicht für alle Förderstätten, fördern alle im selben Verhältnis weniger. Baue die [[solar|Sonnenkathedrale]] aus, errichte ein [[fusion|Fusionssanktum]] oder stelle [[sat|Sonnenreliquiare]] auf.',
          ],
          [
            'Lager',
            'Ist das Lager eines Rohstoffs voll, hört seine Förderung auf. Baue das passende Lager aus ([[smetal]], [[scrystal]], [[sdeut]]) oder gib Rohstoffe aus.',
          ],
          [
            'Eingestellter Anteil',
            'Läuft ein Gebäude nicht auf dem vollen Anteil, den du eingestellt hast, fördert es entsprechend weniger.',
          ],
          [
            'Temperatur',
            'Die [[deut|Promethium-Raffinerie]] fördert auf kalten Planeten mehr und auf warmen weniger.',
          ],
          [
            'Leerer Vorrat',
            'Verbraucht ein Gebäude einen Rohstoff, dessen Vorrat leer ist, läuft es gedrosselt, genau so, dass der Vorrat bei null bleibt.',
          ],
          [
            'Urlaubsmodus',
            'Im [[rule-vacation|Urlaubsmodus]] ruht die Förderung.',
          ],
        ]),
        ...stand,
      ),
    ];
  },
};
