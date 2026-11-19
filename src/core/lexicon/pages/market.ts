// The rule page „Marktplatz“ (#288, #171): who may trade, the ratios, the
// moving prices, the fee of the Handelsposten and the limit of the day. The
// numbers come from `src/core/market.ts` and the settings of the round; the
// words are a draft of Claude for the owner to check ([V], #288).
import {
  FEE_UNIT,
  feePercent,
  got,
  marketOpen,
  type MarketRound,
  PAIRS,
  PRICE_UNIT,
  priceAfter,
  RATIO_UNIT,
  ratiosOf,
  RES_NAME,
  TRADED,
} from '../../market.ts';
import {
  count,
  facts,
  formulas,
  hours,
  number,
  say,
  section,
  table,
} from '../say.ts';
import type { Block, LexState, PageDef, PageSection } from '../types.ts';

const LEVELS = [1, 2, 3, 5, 10, 15];

const rulesSection = (s: LexState): PageSection => {
  const round = s.round as unknown as MarketRound;
  return section(
    'rules',
    'So wird getauscht',
    say(
      'Auf dem Marktplatz tauschst du Adamant, Psikristall und Promethium gegeneinander; Energie lässt sich nicht tauschen. Du brauchst dafür einen [[market|Handelsposten]] auf dem Planeten, auf dem du tauschst. Wie viel du bekommst, bestimmen die Verhältnisse, die der Admin je Rohstoffpaar festlegt, der aktuelle Preis und die Gebühr. Reicht das Lager des Planeten für das Ergebnis nicht, wird der Tausch gekürzt: Du bekommst, was hineinpasst, und gibst nur die Menge dafür her.',
    ),
    facts([['Marktplatz in dieser Runde', marketOpen(round) ? 'ja' : 'nein']]),
  );
};

/** The formulas of an exchange and of the price; checked against `got` and `priceAfter`. */
const MARKET_FORMULAS: Block = formulas(
  {
    text: 'Ergebnis = ⌊Menge · Verhältnis ÷ {unit} · Preis ÷ {price} · ({fee} − Gebühr) ÷ {fee}⌋, mit dem Preis in Millionsteln des Basispreises und der Gebühr in Tausendsteln des Ergebnisses',
    values: {
      unit: number(RATIO_UNIT),
      price: number(PRICE_UNIT),
      fee: number(FEE_UNIT),
    },
    fn: (amount, ratio, price, fee) =>
      Math.floor(
        (amount! * ratio! * price! * (FEE_UNIT - fee!)) /
          (RATIO_UNIT * PRICE_UNIT * FEE_UNIT),
      ),
    rule: (amount, ratio, price, fee) =>
      got(amount!, {
        ratio: ratio!,
        price: price!,
        fee: fee!,
      }),
    samples: [
      [1000, 500, 1_000_000, 100],
      [20000, 2000, 909_090, 50],
      [333, 4000, 1_000_000, 0],
    ],
  },
  {
    text: 'Neuer Preis = ⌊Preis · {price} ÷ ({price} + Preisschritt · getauschte Menge)⌋',
    values: { price: number(PRICE_UNIT) },
    fn: (price, step, given) =>
      Math.floor((price! * PRICE_UNIT) / (PRICE_UNIT + step! * given!)),
    rule: (price, step, given) => priceAfter(price!, given!, step!),
    samples: [
      [1_000_000, 5, 20000],
      [900_000, 1, 1000],
      [500_000, 1000, 5000],
    ],
  },
);

const ratiosSection = (s: LexState): PageSection => {
  const round = s.round as unknown as MarketRound;
  const ratios = ratiosOf(round);
  return section(
    'ratios',
    'Verhältnisse und Preise',
    say(
      'Das Verhältnis nennt, wie viel du für {unit} bekommst, wenn der Preis der Basispreis ist und keine Gebühr anfällt. Jeder Tausch senkt den Preis genau dieses Paares um einen Anteil der getauschten Menge; das umgekehrte Paar behält seinen Preis, damit sich eine Folge von Tauschen nicht lohnt. Danach erholt sich der Preis gleichmäßig bis zum Basispreis, in dieser Runde in {drift}. Der Anteil beträgt {step} Promille je {unit} getauschter Einheiten. Alle Spieler haben denselben Preis.',
      {
        unit: number(RATIO_UNIT),
        drift: hours(round.marketDrift),
        step: number(round.marketStep),
      },
    ),
    table(
      'Verhältnisse dieser Runde',
      ['Du gibst', 'Du bekommst', `Menge für ${number(RATIO_UNIT)} gegebene`],
      PAIRS.map((pair) => [
        RES_NAME[pair[0] as (typeof TRADED)[number]],
        RES_NAME[pair[1] as (typeof TRADED)[number]],
        ratios[pair],
      ]),
    ),
    MARKET_FORMULAS,
  );
};

const feeSection = (s: LexState): PageSection => {
  const round = s.round as unknown as MarketRound;
  return section(
    'fee',
    'Gebühr und Tageslimit',
    say(
      'Die Gebühr zieht der Handelsposten vom Ergebnis ab. Sie beträgt auf Stufe eins {fee} und sinkt mit jeder weiteren Stufe um {step}, aber nie unter null. Außerdem darf jeder Spieler an einem Tag, gezählt nach UTC, nur eine begrenzte Menge tauschen: {limit}. Wer mehr tauschen will, als vom Tag übrig ist, tauscht nur den Rest; ist nichts mehr übrig, wird der Tausch abgelehnt. Der Admin legt Gebühr und Limit für die Runde fest.',
      {
        fee: `${number(round.marketFee)} %`,
        step: count(round.marketFeeStep, 'Prozentpunkt', 'Prozentpunkte'),
        limit:
          round.marketLimit === 0
            ? 'in dieser Runde gibt es kein Limit'
            : `in dieser Runde ${number(round.marketLimit)} Einheiten`,
      },
    ),
    table(
      'Gebühr nach Stufe des Handelspostens',
      ['Stufe', 'Gebühr'],
      LEVELS.map((level) => [
        level,
        `${number(feePercent(level, round.marketFee, round.marketFeeStep))} %`,
      ]),
    ),
  );
};

export const page: PageDef = {
  id: 'rule-market',
  kind: 'rule',
  title: 'Marktplatz',
  line: 'Wie du Rohstoffe tauschst: Verhältnisse, Preise, Gebühr und Tageslimit dieser Runde.',
  keywords: ['tauschen', 'Handel', 'Kurs', 'Gebühr', 'Rohstoffe'],
  seeAlso: ['market', 'faq-resources'],
  sections: (s) => [rulesSection(s), ratiosSection(s), feeSection(s)],
};
