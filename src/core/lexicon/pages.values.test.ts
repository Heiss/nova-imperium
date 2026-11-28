// What the rule pages and the questions say for a state (#288): the numbers
// come from the rules and the round, so a changed setting changes the page.
// The guards of `pages.test.ts` check that nothing is typed; these tests check
// that the right values arrive.
import { describe, expect, it } from 'vitest';
import { planet } from '../../test/fixtures.ts';
import { STATES } from '../../test/lexicon-states.ts';
import { buildable, MOBILE } from '../catalog.ts';
import { arrivalBlocked, limitReached, planetLimit } from '../colony-limit.ts';
import { drawEvent, drawSize, EVENT_KINDS, raidFleet } from '../expedition.ts';
import { holdFuel } from '../flight.ts';
import { type Gate, jumpError } from '../jump-gate.ts';
import type { Universe } from '../types.ts';
import { unionFlight } from '../union.ts';
import { CENTRED, surveyFindings, surveyTier, TIERS } from '../survey.ts';
import { GUILD_RIGHTS } from '../guild-ranks.ts';
import { pageParts } from './docs.ts';
import { PAGES } from './pages/index.ts';
import { defaultState } from './state.ts';
import type { LexState, Own } from './types.ts';

/** A generator that gives these numbers in turn, then 0. */
const draws =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0;

const page = (id: string) => PAGES.find((p) => p.id === id)!;

/** The words of a page for a state, one string. */
const words = (id: string, s: LexState = defaultState()): string =>
  pageParts(page(id), s)
    .map((x) => x.text)
    .join('\n');

/** The default state with other values of the round. */
const withRound = (over: Record<string, number | boolean>): LexState => {
  const s = defaultState();
  return { ...s, round: { ...s.round, ...over } };
};

/** The same, for a setting that is also a row of the universe settings (`live`, under its stored key). */
const withLive = (
  over: Record<string, number>,
  stored: Record<string, number>,
): LexState => {
  const s = withRound(over);
  return { ...s, u: { ...s.u, ...stored } };
};

/** The rows of the table with this caption, as strings. */
function rowsOf(id: string, caption: string, s = defaultState()): string[][] {
  const t = page(id)
    .sections(s)
    .flatMap((x) => x.blocks)
    .find((b) => b.t === 'table' && b.caption === caption);
  if (t?.t !== 'table') throw new Error(`no table ${caption}`);
  return t.rows.map((r) =>
    r.cells.map((c) => (typeof c === 'object' ? c.text : String(c))),
  );
}

const own = (over: Partial<Own> = {}): Own => ({
  planet: planet(),
  planets: 3,
  fleets: 0,
  points: { own: 1000, top: 5000 },
  now: 0,
  ...over,
});

describe('the rule pages say the values of the rules', () => {
  it('Kampf: the rounds, the research bonus, the loot and the rebuilt defense', () => {
    const text = words('rule-battle');
    expect(text).toContain('höchstens 6 Runden');
    expect(text).toContain('schwächer ist als 1 % des Schilds');
    expect(text).toContain('unter 70 % ihres Höchstwerts');
    expect(text).toContain('Jede Stufe legt 10 % des Grundwerts obendrauf');
    expect(text).toContain('70 % je Art');
    expect(text).toContain('ab 50 Stück wird der Anteil gerundet');
    expect(text).toContain('lädt er bis zu 50 % jedes Rohstoffs');
    // 200,000 Adamant and the free hold of 10,000: a third Adamant first.
    expect(
      rowsOf(
        'rule-battle',
        words('rule-battle').match(/Beute bei[^\n]*/)![0],
      )[0],
    ).toEqual(['10000', '3333', '3333', '3334']);
  });

  it('Kampf: the table of units has every fighter, the rapid fire only those that have it', () => {
    const units = rowsOf('rule-battle', 'Werte der Einheiten ohne Forschung');
    expect(units.length).toBeGreaterThanOrEqual(22);
    expect(units.find((r) => r[0] === 'Fregatte')).toBeDefined();
    const rapid = rowsOf('rule-battle', 'Schnellfeuer der Einheiten');
    expect(rapid.length).toBeGreaterThan(5);
    for (const [, against] of rapid) expect(against).toMatch(/ \d/);
  });

  it('Flug: the universe speed divides the time and the slots follow the research', () => {
    const d = STATES[0]!;
    const other = STATES[1]!;
    expect(words('rule-flight', d)).toContain(
      'laufen alle Flüge 5-mal so schnell',
    );
    expect(words('rule-flight', other)).toContain(
      'laufen alle Flüge 40-mal so schnell',
    );
    expect(words('rule-flight', other)).toContain(
      'Dein Stand: Stufe 6 der Kogitator-Doktrin, 7 Flottenslots.',
    );
    const row = (s: LexState) =>
      rowsOf(
        'rule-flight',
        'Tempo und Flugzeit der Schiffe bei vollem Tempo',
        s,
      )[0]!;
    expect(row(d)[0]).toBe('Frachtläufer');
    // A faster universe is faster, and the research raises the speed.
    expect(row(other)[2]).not.toBe(row(d)[2]);
    expect(Number(row(other)[1]!.replace('.', ''))).toBeGreaterThan(
      Number(row(d)[1]!.replace('.', '')),
    );
  });

  it('Planeten: the home planet, the fields by position and the demolition of the round', () => {
    expect(words('rule-planets')).toContain(
      'Dein Heimatplanet hat immer 163 Felder',
    );
    const rows = rowsOf(
      'rule-planets',
      'Felder, Temperatur und Typ einer neuen Kolonie nach Position',
    );
    expect(rows).toHaveLength(15);
    expect(rows[0]).toEqual([
      '1',
      '96 bis 172',
      '120 bis 140 °C',
      'Trockener Planet',
      'Wüstenplanet',
    ]);
    expect(rows[14]![1]).toBe('90 bis 164');
    expect(
      words(
        'rule-planets',
        withLive({ demolitionRefund: -20 }, { roundDemolitionRefund: -20 }),
      ),
    ).toContain('der Faktor -20 %');
  });

  it('Marktplatz: the fee and the limit of the round, and the ratios', () => {
    const text = words(
      'rule-market',
      withRound({ marketFee: 25, marketFeeStep: 5, marketLimit: 0 }),
    );
    expect(text).toContain('auf Stufe eins 25 %');
    expect(text).toContain('um 5 Prozentpunkte');
    expect(text).toContain('in dieser Runde gibt es kein Limit');
    expect(
      rowsOf(
        'rule-market',
        'Gebühr nach Stufe des Handelspostens',
        withRound({ marketFee: 25, marketFeeStep: 10 }),
      ).slice(0, 4),
    ).toEqual([
      ['1', '25 %'],
      ['2', '15 %'],
      ['3', '5 %'],
      ['5', '0 %'],
    ]);
    expect(rowsOf('rule-market', 'Verhältnisse dieser Runde')[0]).toEqual([
      'Adamant',
      'Psikristall',
      '500',
    ]);
  });

  it('Marktplatz: no recovery in a round with 0 hours, the sentence of the drift time otherwise (#346)', () => {
    const none = words('rule-market', withRound({ marketDrift: 0 }));
    expect(none).toContain(
      'damit sich eine Folge von Tauschen nicht lohnt. In dieser Runde erholt sich der Preis nicht. Der Anteil beträgt',
    );
    expect(none).not.toContain('Danach erholt sich der Preis');
    const some = words('rule-market', withRound({ marketDrift: 1 }));
    expect(some).toContain(
      'Danach erholt sich der Preis gleichmäßig bis zum Basispreis, in dieser Runde in',
    );
    expect(some).not.toContain('In dieser Runde erholt sich der Preis nicht.');
  });

  it('Kolonien: the limit by research only where the round has both', () => {
    const none = words('rule-colonies');
    expect(none).toContain('Grundgrenze in dieser Runde: keine Grenze');
    expect(none).not.toContain('Planetengrenze nach der Kolonialverwaltung');
    const limited = withRound({ colonyBase: 6, colonyResearch: 1 });
    const text = words('rule-colonies', {
      ...limited,
      u: { ...limited.u, ...{ roundColonyBase: 6, roundColonyResearch: 1 } },
    });
    expect(text).toContain('Planetengrenze nach der Kolonialverwaltung');
    expect(text).toContain('Grundgrenze in dieser Runde: 6');
    expect(text).toContain(
      'ist die Grenze damit erreicht, wird der Start abgelehnt',
    );
    // At the launch the planets and the Landnahmen on their way count, at the arrival only the planets.
    const rules = { base: 6, research: true, perLevel: 2, maxLevel: 4 };
    expect(limitReached(planetLimit(rules, 0), { owned: 5, flying: 1 })).toBe(
      true,
    );
    expect(arrivalBlocked(planetLimit(rules, 0), 5)).toBe(false);
    expect(arrivalBlocked(planetLimit(rules, 0), 6)).toBe(true);
    // A level above the highest level counts as the highest.
    expect(planetLimit(rules, 9)).toBe(planetLimit(rules, 4));
  });

  it('Sichtbarkeit und Rewards: thresholds and days of the round', () => {
    const text = words(
      'rule-vision',
      withRound({ recognitionTotal: 1, inactiveDays: 3 }),
    );
    expect(text).toContain('Ab Stufe 1 siehst du die Zahl der Schiffe');
    expect(text).toContain('Wer 3 Tage nichts getan hat, gilt als inaktiv');
    const days = rowsOf(
      'rule-rewards',
      words('rule-rewards').match(/Belohnung bei[^\n]*/)![0],
    );
    expect(days[0]!.slice(0, 2)).toEqual(['1', '30']);
    expect(days.find((r) => r[0] === '30')![1]).toBe('90');
    expect(days.find((r) => r[0] === '60')![1]).toBe('90');
  });

  it('Gilden, Urlaub, Endzeit und Schutz: rights, hours, levels and the border', () => {
    expect(rowsOf('rule-guilds', 'Die Rechte eines Rangs')).toHaveLength(
      GUILD_RIGHTS.length,
    );
    expect(words('rule-vacation', withRound({ vacationHours: 96 }))).toContain(
      'in dieser Runde 96 Stunden',
    );
    const levels = rowsOf('rule-endzeit', 'Gebäude des Heimatplaneten');
    expect(levels.find((r) => r[0] === 'Scholarium')![1]).toBe('20');
    expect(rowsOf('rule-protection', 'Wer vor dir geschützt ist')[1]).toEqual([
      '1000',
      '200',
    ]);
  });
});

describe('the rule pages of the missions say the values of the rules', () => {
  it('Raketen: places, range, flight time and the damage as the rules have them', () => {
    const text = words('rule-missiles');
    expect(text).toContain('Jede Stufe schafft 10 Plätze.');
    expect(text).toContain(
      'Eine Abfangrakete belegt 1 Platz, eine Orbitalrakete 2 Plätze',
    );
    // The Raketenkrypta stands on planets only, as the page says.
    expect(buildable('silo', 'moon')).toBe(false);
    expect(buildable('silo', 'planet')).toBe(true);
    expect(
      rowsOf('rule-missiles', 'Reichweite nach dem Plasma-Impulsantrieb'),
    ).toEqual([
      ['1', '4'],
      ['2', '9'],
      ['3', '14'],
      ['5', '24'],
      ['8', '39'],
      ['10', '49'],
    ]);
    // (30 + 60 × 2) / speed 5 = 30 s; at speed 40 it is 3.75 s, shown as 4 s.
    const flight = (s: LexState) =>
      rowsOf(
        'rule-missiles',
        'Flugzeit nach der Entfernung in diesem Universum',
        s,
      );
    expect(flight(STATES[0]!)[1]).toEqual(['2', '30 Sek.']);
    expect(flight(STATES[1]!)[1]).toEqual(['2', '4 Sek.']);
    expect(words('rule-missiles', STATES[1]!)).toContain(
      'Dein Stand: Stufe 9 des Plasma-Impulsantriebs, Reichweite 44 Systeme.',
    );
    expect(words('rule-missiles')).toContain('Reichweite keine.');
    // 12,000 attack against 200 structure of a Raketenbatterie: 60 pieces per missile.
    const hits = rowsOf(
      'rule-missiles',
      'Struktur und Zerstörung als Hauptziel, ohne Forschung und ohne Abfangraketen',
    );
    expect(hits[0]).toEqual([
      'Raketenbatterie',
      '200',
      '60',
      '300',
      '600',
      '1500',
    ]);
    expect(hits).toHaveLength(8);
  });
});

describe('Warp-Tor und Auspex-Phalanx say what the rules do', () => {
  const gate = (id: string, level: number, over: Partial<Gate> = {}): Gate => ({
    id,
    kind: 'moon',
    owner: 'u_a',
    b: level ? { jumpgate: level } : {},
    ready: 0,
    ...over,
  });

  it('the cooldown is the minutes of the table divided by the speed of the universe', () => {
    const rows = rowsOf('rule-gates', 'Wartezeit nach der Stufe des Starttors');
    expect(rows[0]).toEqual(['1', '60', '12 Min. 0 Sek.']);
    expect(rows[9]).toEqual(['10', '17', '3 Min. 24 Sek.']);
    // From level 15 on the time stays the same.
    expect(rows[14]).toEqual(['15', '10', '2 Min. 0 Sek.']);
    expect(rows[15]).toEqual(['20', '10', '2 Min. 0 Sek.']);
    const fast = rowsOf(
      'rule-gates',
      'Wartezeit nach der Stufe des Starttors',
      withLive({}, { speed: 40 }),
    );
    expect(fast[0]).toEqual(['1', '60', '1 Min. 30 Sek.']);
  });

  it('checks the starting gate first, then the target, then the ships, as the page says', () => {
    const from = gate('m1', 3);
    const to = gate('m2', 1);
    const ships = { sc: 1 };
    expect(jumpError({ ...from, kind: 'planet' }, to, ships, 100)).toBe(
      'notMoon',
    );
    expect(jumpError(gate('m1', 0), null, {}, 100)).toBe('noGate');
    expect(jumpError(gate('m1', 3, { ready: 200 }), null, {}, 100)).toBe(
      'cooling',
    );
    expect(jumpError(from, null, {}, 100)).toBe('noTarget');
    expect(jumpError(from, gate('m2', 1, { owner: 'u_b' }), ships, 100)).toBe(
      'noTarget',
    );
    expect(jumpError(from, from, ships, 100)).toBe('sameMoon');
    expect(jumpError(from, gate('m2', 0), ships, 100)).toBe('targetNoGate');
    expect(jumpError(from, gate('m2', 1, { ready: 200 }), ships, 100)).toBe(
      'targetCooling',
    );
    expect(jumpError(from, to, {}, 100)).toBe('noShips');
    expect(jumpError(from, to, { sat: 1 }, 100)).toBe('stationary');
    expect(jumpError(from, to, ships, 100)).toBeNull();
  });

  it('the scan costs the Promethium of the rules and the range is the same formula as on the page Monde', () => {
    expect(words('rule-gates')).toContain(
      'Ein Scan kostet 5.000 Promethium auf dem Mond',
    );
    expect(words('rule-gates')).toContain(
      'Reichweite in Systemen = Stufe² − 1',
    );
  });
});

describe('Wache stellen und Verbandsangriff say what the rules do', () => {
  const live = (over: Record<string, number>) => withLive({}, over);

  it('the guard: who may hold, the times, the limits and the fuel', () => {
    const text = words('rule-allies');
    expect(text).toContain(
      'Verbündete für Halten und Verband: Gilde und Freunde',
    );
    expect(text).toContain(
      'Die Haltezeit beträgt 0, 1, 2, 4, 8, 16 oder 32 Stunden.',
    );
    expect(text).toContain(
      'höchstens 4 verschiedene Spieler mit zusammen höchstens 15 Flotten',
    );
    expect(text).toContain('mindestens 1 Promethium');
    expect(text).toContain(
      'Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre: 2 (von 0 bis 30)',
    );
    expect(
      words('rule-allies', live({ roundAllies: 1, roundHeldSpy: 5 })),
    ).toContain('Verbündete für Halten und Verband: Gilde');
    // A tenth of the base consumption per ship and hour: 10 Frachtläufer for 8 hours.
    expect(holdFuel({ sc: 10 }, 8)).toBe(
      Math.floor((10 * MOBILE.sc!.fuel * 8) / 10),
    );
    expect(holdFuel({}, 0)).toBe(1);
  });

  it('the union: the fixed arrival and the speed of a joining fleet, the cut-off only when it is on (#466)', () => {
    const text = words('rule-allies');
    expect(text).toContain('Ein Verband hat eine feste Ankunftszeit.');
    expect(text).toContain('liegt zwischen 10 % und 100 %');
    expect(text).not.toContain('Verspätung');
    expect(text).toContain(
      'Eine Sperre kurz vor der Ankunft gibt es in dieser Runde nicht.',
    );
    const custom = live({ roundUnionCutoff: 15, roundUnionFleets: 8 });
    const changed = words('rule-allies', custom);
    expect(changed).toContain(
      'In den letzten 15 Minuten vor der Ankunft tritt niemand mehr bei.',
    );
    expect(changed).toContain(
      'Verbandsangriff: höchstens Flotten: 8 (von 1 bis 50)',
    );
    // The speed of the formula is the one the server picks: half the time at
    // 10 % is far from a step of 10 %.
    const out = unionFlight({
      dist: 2700,
      speed: 12500,
      universe: { speed: 1 } as Universe,
      now: 0,
      arr: 6_000_000,
    });
    expect('pct' in out && out.pct).toBeCloseTo(
      (35000 * Math.sqrt((10 * 2700) / 12500)) / (6000 - 10),
      9,
    );
  });
});

describe('Expeditionen say what the expedition does', () => {
  const table = (caption: string, s = defaultState()) =>
    rowsOf('rule-expeditions', caption, s);
  const percentOf = (text: string): number =>
    Number(text.replace(' %', '').replace(',', '.')) / 100;

  it('the shares of the events and of the sizes are those the draw gives', () => {
    // Count the draw over an even grid: first the chance of an event, then its kind.
    const grid = 20_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < grid; i++) {
      const r = (i + 0.5) / grid;
      // The first draw is below 0.84 for an event; the second picks the kind.
      const kind = drawEvent(draws(0.1, r, 0.5)).kind;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const rows = table('Anteil der Ereignisse');
    expect(rows[0]).toEqual(['Nichts', '16 %', '–']);
    EVENT_KINDS.forEach((kind, i) =>
      expect(percentOf(rows[i + 1]![2]!)).toBeCloseTo(
        (counts.get(kind) ?? 0) / grid,
        3,
      ),
    );
    expect(drawEvent(draws(0.84)).kind).toBe('nothing');
    expect(rows[1]).toEqual(['Rohstofffund', '31,5 %', '37,5 %']);
    const sizes = new Map<string, number>();
    for (let i = 0; i < grid; i++) {
      const size = drawSize(draws((i + 0.5) / grid));
      sizes.set(size, (sizes.get(size) ?? 0) + 1);
    }
    expect(table('Anteil der Größen unter den Ereignissen mit Größe')).toEqual([
      ['normal', '89 %'],
      ['groß', '10 %'],
      ['sehr groß', '1 %'],
    ]);
    expect((sizes.get('normal') ?? 0) / grid).toBeCloseTo(0.89, 3);
    expect((sizes.get('huge') ?? 0) / grid).toBeCloseTo(0.01, 3);
  });

  it('the places and the stay follow the research and the settings of the round', () => {
    const s = {
      ...withLive(
        {},
        {
          roundExpeditionExtraSlots: 2,
          roundExpeditionHours: 3,
          roundExpeditionSpeed: 1,
        },
      ),
      research: { expo: 9 },
    };
    // Level 9: 3 places and 2 extra; 27 hours, divided by the speed 5: 5 h 24 min.
    expect(
      table('Plätze und Haltezeit nach der Stufe in dieser Runde', s)[4],
    ).toEqual(['9', '5', '27 Std.', '5 Std. 24 Min.']);
    expect(words('rule-expeditions', s)).toContain(
      'Dein Stand: Stufe 9 der Kreuzzugs-Kartografie, 5 Expeditionsplätze, höchste Haltezeit 27 Std.',
    );
    expect(words('rule-expeditions', s)).toContain(
      'Haltezeit durch das Universums-Tempo teilen: ja',
    );
    expect(words('rule-expeditions')).toContain('der Position 16');
  });

  it('the finds, the raiders and the changes of the return say what the rules do', () => {
    expect(table('Grundzahl, Teiler und Anteil je Sorte')).toEqual([
      ['Adamant', '1', '50 %'],
      ['Psikristall', '2', '33,33 %'],
      ['Promethium', '3', '16,67 %'],
    ]);
    expect(table('Grundzahl eines Rohstofffunds nach Größe')[2]).toEqual([
      'sehr groß',
      '100 bis 200',
    ]);
    expect(table('Grundzahl eines Schiffsfunds nach Größe')[1]).toEqual([
      'groß',
      '52 bis 100',
    ]);
    const finds = table(
      'Was eine Flotte finden kann, nach ihrem schwersten Schiff',
    );
    expect(finds.find((r) => r[0] === 'Spähschädel')![1]).toBe(
      'Spähschädel, Frachtläufer',
    );
    expect(finds.find((r) => r[0] === 'Kolonistenarche')![1]).toBe('keine');
    expect(table('Die Angreifer nach Größe')[0]).toEqual([
      'Piraten',
      'normal',
      '30 %',
      '5 × Abfangjäger',
    ]);
    // Ten ships at the mean: pirates round down (3 of 10 at 30 %), aliens up (4 of 10 at 40 %, 6 of 10 at 60 %).
    expect(raidFleet(() => 0.5, 'pirates', 'normal', { probe: 10 }).probe).toBe(
      3,
    );
    expect(raidFleet(() => 0.5, 'aliens', 'large', { probe: 11 }).probe).toBe(
      7,
    );
    expect(table('Der Faktor nach Größe')).toEqual([
      ['normal', '2'],
      ['groß', '3'],
      ['sehr groß', '5'],
    ]);
    expect(words('rule-expeditions')).toContain(
      'mindestens 1 Sek. lang bleibt er aber',
    );
  });
});

describe('Vermessung says what the survey does', () => {
  it('the score, the tiers and what each tier shows agree with the findings', () => {
    expect(TIERS.map(([min]) => min)).toEqual([10, 7, 4]);
    expect(
      rowsOf(
        'rule-survey',
        'Auspex-Wert nach Spähschädeln und Stufe der Auspex-Kartographie',
      )[0],
    ).toEqual(['1', '3', '5', '7', '11']);
    const text = words('rule-survey');
    expect(text).toContain(
      'Unter 4: Nur, was sich von der Position erraten lässt',
    );
    expect(text).toContain(
      'Ab 4: Dazu die Felder des Planeten, um 20 % nach oben und unten, und seine höchste Temperatur, um 10 °C',
    );
    expect(text).toContain('Sie bleiben 30 Tage erhalten');
    // The words of a tier match what the findings hold: nothing, windows, exact values, the full report.
    const at = (score: number) =>
      surveyFindings(
        { s: 1, p: 9, positions: 15 },
        { temp: 70, diameter: 12000 },
        surveyTier(score),
        { fields: 0, temp: 1 },
      );
    expect(at(3)).not.toHaveProperty('fields');
    expect(at(3)).not.toHaveProperty('temp');
    // 144 fields, a window of ± 20 % is 57.6 wide each way: shifted to its lower end it runs from 144 to 202.
    expect(at(4).fields).toEqual({ min: 144, max: 202 });
    expect(at(4).temp).toEqual({ min: 70 - 20, max: 70 });
    expect(at(7).fields).toEqual({ min: 144, max: 144 });
    expect(at(7).temp).toEqual({ min: 70, max: 70 });
    expect(at(7)).not.toHaveProperty('full');
    expect(at(10).full).toMatchObject({
      fields: 144,
      temp: 70,
      diameter: 12000,
    });
    expect(
      surveyFindings(
        { s: 1, p: 9, positions: 15 },
        { temp: 70, diameter: 12000 },
        'near',
        CENTRED,
      ).fields,
    ).toEqual({ min: 115, max: 173 });
  });

  it('the bands of the orbit follow the positions of the universe, the sizes the field range', () => {
    expect(
      rowsOf('rule-survey', 'Bahn nach der Position in diesem Universum'),
    ).toEqual([
      ['1 bis 3', 'innere Bahn, heiß'],
      ['4 bis 12', 'mittlere Bahn, gemäßigt'],
      ['13 bis 15', 'äußere Bahn, kalt'],
    ]);
    const wide = withLive({}, { positions: 20 });
    expect(
      rowsOf('rule-survey', 'Bahn nach der Position in diesem Universum', wide),
    ).toEqual([
      ['1 bis 4', 'innere Bahn, heiß'],
      ['5 bis 16', 'mittlere Bahn, gemäßigt'],
      ['17 bis 20', 'äußere Bahn, kalt'],
    ]);
    expect(
      rowsOf(
        'rule-survey',
        'Größe nach dem Durchschnitt der Felder der Position',
      ),
    ).toEqual([
      ['96 bis 147', 'klein'],
      ['148 bis 199', 'mittelgroß'],
      ['200 bis 252', 'groß'],
    ]);
  });

  it('the loss chance is the formula, capped, and falls with the level', () => {
    const near = rowsOf(
      'rule-survey',
      'Höchste Verlustchance bei einem Weg von 5 Systemen',
    );
    // One probe, level 1, 5 systems (distance 3175): 5 % + 6 % · 3,175^0,8 / 1,4.
    expect(near[0]![1]).toBe('15,8 %');
    expect(near[3]![1]).toBe('60 %');
    expect(
      Number(near[0]![4]!.replace(' %', '').replace(',', '.')),
    ).toBeLessThan(Number(near[0]![1]!.replace(' %', '').replace(',', '.')));
  });
});

describe('the questions show the own state', () => {
  it('faq-attack: the points of the player and the border below which others are protected', () => {
    const s = {
      ...defaultState(),
      own: own({ points: { own: 1000, top: 9 } }),
    };
    expect(words('faq-attack', s)).toContain(
      'Dein Stand: Du hast 1.000 Punkte. Spieler mit weniger als 200 Punkten sind vor dir geschützt.',
    );
    expect(words('faq-attack')).not.toContain('Dein Stand');
  });

  it('faq-mine: the energy of the shown planet and the full stores', () => {
    const p = planet({
      b: { metal: 10, solar: 1 },
      res: { m: 1e9, c: 0, d: 0 },
    });
    const text = words('faq-mine', {
      ...defaultState(),
      own: own({ planet: p }),
    });
    expect(text).toMatch(
      /Dein Stand auf diesem Planeten: Die Energie reicht für [\d,]+ %/,
    );
    expect(text).toContain('Voll ist das Lager von Adamant');
  });

  it('faq-colony: the limit of planets as the planet list shows it', () => {
    expect(
      words('faq-colony', { ...defaultState(), own: own({ planets: 4 }) }),
    ).toContain('Dein Stand: Planeten: 4 · unbegrenzt');
  });
});

describe('the guides', () => {
  it('„Deine nächsten Ziele“ says that nothing stands out, and waits for a planet', () => {
    const text = words('guide-next');
    expect(text).toContain('Im Moment hebt keine Regel etwas hervor');
    expect(text).toContain(
      'Dein Stand steht hier, sobald du einen Planeten hast.',
    );
  });

  it('„Dich verteidigen“ takes the limits of seeing from the round and the values from the catalog', () => {
    const text = words(
      'guide-defense',
      withRound({
        recognitionTotal: 1,
        recognitionTypes: 3,
        recognitionCounts: 9,
      }),
    );
    expect(text).toContain(
      'Ab Stufe 1 der Auspex-Lehre siehst du, wie viele Schiffe',
    );
    expect(text).toContain('ab Stufe 9 die genaue Zahl');
    expect(
      rowsOf(
        'guide-defense',
        'Kosten und Werte der Verteidigungsanlagen',
      )[0]![0],
    ).toBe('Raketenbatterie');
  });

  it('„Erste Schritte“ starts with the resources of the universe', () => {
    const s = defaultState();
    expect(words('guide-start', s)).toContain(
      'mit 500 Adamant und 500 Psikristall',
    );
    const rich = {
      ...s,
      u: { ...s.u, startMetal: 0, startCrystal: 0, startDeuterium: 9 },
    };
    expect(words('guide-start', rich)).toContain('mit 9 Promethium');
  });
});
