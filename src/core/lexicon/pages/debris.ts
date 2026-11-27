// The rule page „Trümmerfelder und Bergung“ (#288): what a destroyed ship
// leaves, how a field grows, and what a Bergung takes. The numbers come from
// `src/core/debris.ts` and the catalog; the words are a draft of Claude for
// the owner to check ([V], #288).
import { SHIPS } from '../../catalog.ts';
import { DEBRIS_SHARE, debrisOf, harvest } from '../../debris.ts';
import {
  formulas,
  nameOf,
  number,
  percent,
  say,
  section,
  table,
} from '../say.ts';
import type { PageDef, PageSection } from '../types.ts';

/** The field and the free holds the example of the Bergung starts from. */
const FIELD = { m: 60000, c: 30000 };
const FREE = [10000, 45000, 90000, 200000];

/** The ships, as the catalog lists them. */
const KEYS = Object.keys(SHIPS);

const fieldSection = (): PageSection =>
  section(
    'field',
    'Wie ein Trümmerfeld entsteht',
    say(
      'Nach einem Kampf bleiben {share} des Adamants und des Psikristalls aller zerstörten Schiffe beider Seiten als Trümmerfeld an der Position liegen, auch die der Flotten, die dort Wache gehalten haben. Promethium und Verteidigungsanlagen hinterlassen nichts. Ein Trümmerfeld wächst mit jedem Kampf an derselben Position und bleibt liegen, bis es eingesammelt ist; ein leeres Feld verschwindet. Jeder Spieler sieht jedes Trümmerfeld.',
      { share: percent(DEBRIS_SHARE) },
    ),
    formulas({
      text: 'Trümmerfeld = {share} · (Adamant + Psikristall der zerstörten Schiffe)',
      values: { share: percent(DEBRIS_SHARE) },
      fn: (n, i) =>
        DEBRIS_SHARE *
        n! *
        (SHIPS[KEYS[i!]!]!.cost[0] + SHIPS[KEYS[i!]!]!.cost[1]),
      rule: (n, i) => {
        const field = debrisOf([{ before: { [KEYS[i!]!]: n! }, after: {} }]);
        return field.m + field.c;
      },
      samples: [
        [1, 0],
        [10, 3],
        [250, 6],
        [7, KEYS.length - 1],
      ],
    }),
    table(
      'Was ein zerstörtes Schiff am Trümmerfeld hinterlässt',
      ['Schiff', 'Adamant', 'Psikristall'],
      KEYS.map((key) => {
        const field = debrisOf([{ before: { [key]: 1 }, after: {} }]);
        return [{ text: nameOf(key), link: key }, field.m, field.c];
      }),
    ),
  );

const harvestSection = (): PageSection =>
  section(
    'harvest',
    'Die Bergung',
    say(
      'Eine Bergung braucht mindestens eine [[recycler|Bergungsbarke]] in der Flotte und fliegt zu einem Trümmerfeld. Eingesammelt wird, was der Laderaum aller Schiffe der Flotte noch fasst, nicht nur der der Bergungsbarken. Adamant und Psikristall werden gleichmäßig geladen, bis die kleinere der beiden Mengen aufgebraucht ist, danach der Rest der anderen. Ein Trümmerfeld ist nicht geschützt: Die erste Flotte, die ankommt, nimmt es sich, eine spätere nur, was übrig ist. Findet eine Flotte kein Feld mehr, fliegt sie leer zurück.',
    ),
    table(
      `Bergung eines Feldes mit ${number(FIELD.m)} Adamant und ${number(FIELD.c)} Psikristall`,
      ['Freier Laderaum', 'Adamant', 'Psikristall', 'Bleibt im Feld'],
      FREE.map((free) => {
        const take = harvest(FIELD, free);
        return [free, take.m, take.c, FIELD.m - take.m + (FIELD.c - take.c)];
      }),
    ),
    say(
      'Aus einem Trümmerfeld kann auch ein Mond entstehen; wie, steht unter [[rule-moons]].',
    ),
  );

const page: PageDef = {
  id: 'rule-debris',
  kind: 'rule',
  title: 'Trümmerfelder und Bergung',
  line: 'Was zerstörte Schiffe hinterlassen und wie eine Bergung es einsammelt.',
  keywords: ['Trümmer', 'Wrack', 'Schrott', 'bergen', 'einsammeln'],
  seeAlso: ['recycler', 'mission-harvest', 'rule-battle', 'rule-moons'],
  sections: () => [fieldSection(), harvestSection()],
};

// Its place on the start page of the Lexicanum (#426).
export const lexiconPage = { order: 40, page };
