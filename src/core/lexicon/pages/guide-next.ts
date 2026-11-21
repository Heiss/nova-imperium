// The page „Deine nächsten Ziele“ (#289, D2 option 1): what the rules of the
// game suggest for the player's own state, computed by `hintsOf`: energy that
// is short, a store that is full, no free field, every fleet slot in use, the
// limit of planets, a requirement one level away. Every hint is a rule of the
// game and none an opinion; the words are a draft of Claude for the owner to
// check ([V], #289). The review list shows the page in states that together
// hold every hint.
import { hintsOf } from '../hints.ts';
import { defaultState } from '../state.ts';
import { number, say, section } from '../say.ts';
import type { Block, LexState, Own, PageDef, PageSection } from '../types.ts';

/** A shown planet for the states of the review list, with what a hint needs to change. */
const planetWith = (over: Partial<Own['planet']>): Own['planet'] => ({
  id: 'p1_1_5',
  owner: 'u1',
  kind: 'planet',
  name: 'Heimat',
  g: 1,
  s: 1,
  p: 5,
  created: 0,
  t: 0,
  temp: 50,
  diameter: 12800,
  unlimited: false,
  b: {},
  ships: {},
  def: {},
  res: { m: 0, c: 0, d: 0 },
  pct: {},
  bq: null,
  sq: [],
  sqT: null,
  ...over,
});

const stateOf = (planet: Own['planet'], own: Partial<Own> = {}): LexState => ({
  ...defaultState(),
  own: {
    planet,
    planets: 1,
    fleets: 0,
    points: { own: 0, top: 0 },
    now: 0,
    ...own,
  },
});

/** The states the review list shows: a planet with a lack of everything, one without a mine, and a full moon. */
const REVIEW: readonly LexState[] = [
  (() => {
    const s = stateOf(
      planetWith({
        diameter: 1000,
        b: { metal: 10, solar: 1, lab: 2 },
        res: { m: 1e9, c: 0, d: 0 },
      }),
      { planets: 3, fleets: 1 },
    );
    // A limit of three planets with the research that raises it.
    return {
      ...s,
      u: { ...s.u, roundColonyBase: 3, roundColonyResearch: 1 },
    };
  })(),
  stateOf(planetWith({})),
  stateOf(planetWith({ kind: 'moon', b: { robot: 1 } })),
];

const hintsSection = (s: LexState): PageSection => {
  const hints = hintsOf(s);
  const blocks: Block[] = hints.length
    ? hints.map((h) => say(h.text, h.values))
    : [
        say(
          'Im Moment hebt keine Regel etwas hervor. Was sich sonst aufbauen lässt, steht unter [[guide-start]].',
        ),
      ];
  return section(
    'now',
    'Was die Regeln gerade nahelegen',
    say(
      'Diese Seite rechnet aus deinem Stand, was die Regeln hervorheben: Energie, die fehlt, ein volles Lager, kein freies Feld, belegte Flottenslots, die Planetengrenze oder eine Voraussetzung, die nur noch eine Stufe entfernt ist. Es sind keine Ratschläge zum Spielstil, nur Folgen der Regeln.',
    ),
    ...blocks,
  );
};

const standSection = (s: LexState): PageSection =>
  section(
    'stand',
    'Dein Stand',
    ...(s.own
      ? ([
          {
            t: 'stand',
            text: `Dein Stand: Planeten: ${number(s.own.planets)} · Flotten unterwegs: ${number(s.own.fleets)} · Punkte: ${number(s.own.points.own)}`,
          },
        ] as Block[])
      : [say('Dein Stand steht hier, sobald du einen Planeten hast.')]),
  );

export const page: PageDef = {
  id: 'guide-next',
  kind: 'guide',
  title: 'Deine nächsten Ziele',
  line: 'Was deine Planeten, deine Forschung und deine Flotten nach den Regeln als Nächstes nahelegen.',
  keywords: ['Ziele', 'nächste', 'Ratschlag', 'Hinweis', 'Empfehlung'],
  seeAlso: ['guide-start', 'rule-production', 'faq-slots', 'rule-colonies'],
  review: REVIEW,
  sections: (s) => [hintsSection(s), standSection(s)],
};
