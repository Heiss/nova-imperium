// The guide „Dich verteidigen“ (#289): what the rules give a defender, in the
// order in which it helps. The numbers come from the catalog, the battle and
// the round; the words are a draft of Claude for the owner to check ([V],
// #289, D1 and D3 as recommended).
import { TECH_BONUS } from '../../battle.ts';
import { DEF, FIGHTERS } from '../../catalog.ts';
import { strength } from '../../components/combat.ts';
import { recognitionOf } from '../../fleet-recognition.ts';
import {
  costText,
  nameOf,
  number,
  percent,
  section,
  steps,
  table,
} from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** The defense that fights, as the catalog lists it. */
const FIGHTING = Object.keys(DEF).filter((key) => key in FIGHTERS);

const stepsSection = (s: LexState): PageSection => {
  const r = recognitionOf(s.round);
  return section(
    'steps',
    'In dieser Reihenfolge',
    steps(
      `Erkenne, wer kommt: Ab Stufe ${number(r.total)} der [[spy|Auspex-Lehre]] siehst du, wie viele Schiffe auf dich zufliegen, ab Stufe ${number(r.types)} welche Arten und ab Stufe ${number(r.counts)} die genaue Zahl ([[rule-vision]]).`,
      'Baue Verteidigungsanlagen in der [[yard|Orbitalen Schiffsschmiede]]; die Tabelle unten nennt Kosten und Werte. Nach einem Kampf wird ein Teil der zerstörten Verteidigung wieder aufgebaut ([[rule-battle]]).',
      `Erforsche die [[weapons|Waffensegnung]], die [[shield|Refraktionsfelder]] und die [[armor|Adamant-Panzerung]]: Jede Stufe hebt Angriff, Schild oder Struktur aller deiner Einheiten um ${percent(TECH_BONUS)} des Grundwerts.`,
      'Bitte Gildenmitglieder und Freunde, bei dir [[mission-hold|Wache zu stellen]]: Ihre Flotten kämpfen dann mit dir ([[rule-guilds]]).',
      'Halte Abfangraketen in der [[silo|Raketenkrypta]] bereit: Jede [[abm|Abfangrakete]] hält eine anfliegende Orbitalrakete auf.',
      'Denke an den Schutz: Wer viel weniger Punkte hat als der Angreifer, steht unter Noobschutz, und im Urlaubsmodus ist alles geschützt ([[rule-protection]]).',
    ),
  );
};

const tableSection = (): PageSection =>
  section(
    'table',
    'Die Verteidigungsanlagen',
    table(
      'Kosten und Werte der Verteidigungsanlagen',
      ['Anlage', 'Kosten', 'Angriff', 'Schild', 'Struktur'],
      FIGHTING.map((key) => {
        const v = strength(FIGHTERS[key]!);
        return [
          { text: nameOf(key), link: key },
          costText(DEF[key]!.cost),
          v.attack,
          v.shield,
          v.hull,
        ];
      }),
    ),
  );

const page: PageDef = {
  id: 'guide-defense',
  kind: 'guide',
  title: 'Dich verteidigen',
  line: 'Was dich schützt und wie du dich auf einen Angriff vorbereitest.',
  keywords: ['verteidigen', 'Abwehr', 'Angriff', 'Verteidigung', 'sichern'],
  seeAlso: ['faq-defend', 'rule-battle', 'rule-protection', 'mission-hold'],
  sections: (s) => [stepsSection(s), tableSection()],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 360, page };
