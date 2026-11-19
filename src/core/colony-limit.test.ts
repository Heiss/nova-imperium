// The limit of planets per player (#237; owner, 2026-11-16 and 2026-11-17):
// the four settings of the round, the limit from the research level, the
// reservation of a Landnahme on its way, the words and the research „Kolonial-
// verwaltung“. The entries are selected by their group, not by a position.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE, universeErrors } from './universe.ts';
import {
  arrivalBlocked,
  arrivalText,
  COLONY_RANGE,
  colonyLevel,
  colonyPreview,
  type ColonyRules,
  colonyRules,
  limitFor,
  limitLine,
  limitReached,
  limitText,
  MOST_PLANETS,
  planetLimit,
  researchLine,
  researchNote,
  researchOffered,
  researchRefused,
  roundSettings,
} from './colony-limit.ts';
import { roundDefaults } from '../test/fixtures.ts';
import {
  ROUND_SETTINGS,
  roundPreview,
  roundRefused,
  roundRequest,
  roundShown,
  roundValues,
  storedValues,
} from './round.ts';

/** The owner's example: 6 planets, 2 more per level, level 4 at most. */
const EXAMPLE: ColonyRules = {
  base: 6,
  research: true,
  perLevel: 2,
  maxLevel: 4,
};

/** The entries of the group, as the registry holds them. */
const SETTINGS = ROUND_SETTINGS.filter((s) => s.group?.name === 'colonies');
const RESEARCH = SETTINGS[1];

describe('the settings of the planet limit in the registry', () => {
  it('are four live entries in one fieldset „Planetengrenze“, in the file`s order (#310, X1)', () => {
    expect(SETTINGS).toEqual(roundSettings);
    expect(SETTINGS.map((s) => s.key)).toEqual([
      'roundColonyBase',
      'roundColonyResearch',
      'roundColonyPerLevel',
      'roundColonyMaxLevel',
    ]);
    expect(SETTINGS.map((s) => s.name)).toEqual([
      'colonyBase',
      'colonyResearch',
      'colonyPerLevel',
      'colonyMaxLevel',
    ]);
    expect(SETTINGS.map((s) => s.order)).toEqual([440, 450, 460, 470]);
    for (const s of SETTINGS) {
      expect(s.kind).toBe('number');
      expect(s.group?.legend).toBe('Planetengrenze');
      expect((s as { live?: true }).live).toBe(true);
    }
  });

  it('have the labels of the dialog and the ranges within the owner`s 20 planets [V]', () => {
    expect(SETTINGS.map((s) => s.label)).toEqual([
      'Maximale Planeten ohne Forschung (0 = unbegrenzt, der Heimatplanet zählt mit)',
      'Kolonieforschung aktivieren',
      'Zusätzliche Planeten je Forschungsstufe',
      'Maximale Forschungsstufe (0 = unbegrenzt erforschbar)',
    ]);
    expect(MOST_PLANETS).toBe(20);
    expect(
      SETTINGS.map((s) => (s.kind === 'number' ? [s.min, s.max, s.def] : [])),
    ).toEqual([
      [0, 20, 0],
      [0, 1, 0],
      [1, 20, 2],
      [0, 20, 4],
    ]);
    expect(COLONY_RANGE.base.def).toBe(0);
    expect(RESEARCH!.kind === 'number' && RESEARCH!.choices).toEqual([
      { value: 0, label: 'Nein' },
      { value: 1, label: 'Ja' },
    ]);
  });

  it('start a round without a limit and without the research, as before (#237, defaults)', () => {
    const rules = colonyRules(DEFAULT_UNIVERSE);
    expect(rules).toEqual({
      base: 0,
      research: false,
      perLevel: 2,
      maxLevel: 4,
    });
    expect(planetLimit(rules, 0)).toBeNull();
    expect(planetLimit(rules, 9)).toBeNull();
  });

  it('are read from the stored round and sent as one group', () => {
    const stored: Record<string, number> = {
      roundColonyBase: 6,
      roundColonyResearch: 1,
      roundColonyPerLevel: 2,
      roundColonyMaxLevel: 4,
    };
    expect(storedValues((k) => stored[k], SETTINGS)).toEqual({
      colonyBase: 6,
      colonyResearch: 1,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    });
    expect(
      roundRequest(
        {
          colonyBase: 6,
          colonyResearch: 1,
          colonyPerLevel: 2,
          colonyMaxLevel: 4,
        },
        SETTINGS,
      ),
    ).toEqual({
      colonies: {
        colonyBase: 6,
        colonyResearch: 1,
        colonyPerLevel: 2,
        colonyMaxLevel: 4,
      },
    });
    expect(roundDefaults()).toMatchObject({
      colonyBase: 0,
      colonyResearch: 0,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    });
  });
});

describe('the rule between the settings: research needs a base limit (#237)', () => {
  const current = {
    colonyBase: 0,
    colonyResearch: 0,
    colonyPerLevel: 2,
    colonyMaxLevel: 4,
  };
  const send = (over: Record<string, number>) => ({
    colonies: { ...current, ...over },
  });

  it('refuses the research with base 0 in „Neue Runde“ with the owner`s words, and takes it with a base', () => {
    const refused = roundRefused(
      current,
      send({ colonyResearch: 1 }),
      SETTINGS,
    );
    expect(refused.map((s) => s.name)).toEqual(['colonyResearch']);
    expect(refused[0]!.refusal).toBe(
      'Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.',
    );
    expect(
      roundRefused(
        current,
        send({ colonyResearch: 1, colonyBase: 6 }),
        SETTINGS,
      ),
    ).toEqual([]);
    expect(roundRefused(current, send({ colonyBase: 0 }), SETTINGS)).toEqual(
      [],
    );
  });

  it('uses the base of the current round when only the switch is sent', () => {
    const six = { ...current, colonyBase: 6 };
    expect(
      roundRefused(six, send({ colonyResearch: 1, colonyBase: 6 }), SETTINGS),
    ).toEqual([]);
    expect(
      roundValues(six, { colonies: { ...six, colonyResearch: 1 } }, SETTINGS),
    ).toMatchObject({ colonyBase: 6, colonyResearch: 1 });
  });

  it('names the range first when a value is outside it: the rule is asked only for values in their range', () => {
    const refused = roundRefused(
      current,
      send({ colonyResearch: 1, colonyBase: 21 }),
      SETTINGS,
    );
    expect(refused.map((s) => s.name)).toEqual(['colonyBase']);
    expect(
      roundRefused(current, send({ colonyPerLevel: 0 }), SETTINGS).map(
        (s) => s.name,
      ),
    ).toEqual(['colonyPerLevel']);
  });

  it('is the same rule in the universe settings, changed live (X1)', () => {
    const used = { g: 1, s: 1, p: 1 };
    const input = {
      ...DEFAULT_UNIVERSE,
      roundColonyBase: 0,
      roundColonyResearch: 1,
    };
    const errors = universeErrors(input, used);
    expect(errors.map((e) => [e.spec.key, e.code])).toEqual([
      ['roundColonyResearch', 'conflict'],
    ]);
    expect(errors[0]!.spec.refusal).toBe(
      'Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.',
    );
    expect(universeErrors({ ...input, roundColonyBase: 6 }, used)).toEqual([]);
    expect(universeErrors({ ...input, roundColonyResearch: 0 }, used)).toEqual(
      [],
    );
    // A value out of its range is a range error, and the rule is not asked.
    expect(
      universeErrors({ ...input, roundColonyBase: 21 }, used).map((e) => [
        e.spec.key,
        e.code,
      ]),
    ).toEqual([['roundColonyBase', 'range']]);
  });
});

describe('the limit of planets', () => {
  it('is 6, 8, 10, 12 and 14 at the levels 0 to 4 of the owner`s example (#237)', () => {
    expect([0, 1, 2, 3, 4].map((l) => planetLimit(EXAMPLE, l))).toEqual([
      6, 8, 10, 12, 14,
    ]);
  });

  it('counts a level above the highest as the highest: level 5 brings nothing', () => {
    expect(planetLimit(EXAMPLE, 5)).toBe(14);
    expect(planetLimit(EXAMPLE, 99)).toBe(14);
  });

  it('has no ceiling of levels with a highest level of 0, but never more than 20 planets in total (D6)', () => {
    const open = { ...EXAMPLE, maxLevel: 0 };
    expect([0, 4, 7, 8, 50].map((l) => planetLimit(open, l))).toEqual([
      6, 14, 20, 20, 20,
    ]);
    expect(planetLimit({ ...EXAMPLE, base: 20 }, 3)).toBe(20);
  });

  it('is the base without the research, whatever level a player has', () => {
    const off = { ...EXAMPLE, research: false };
    expect([0, 3, 9].map((l) => planetLimit(off, l))).toEqual([6, 6, 6]);
  });

  it('is no limit with a base of 0, whatever the research does', () => {
    for (const research of [false, true])
      expect(
        planetLimit({ base: 0, research, perLevel: 2, maxLevel: 4 }, 3),
      ).toBeNull();
  });

  it('never rises when the level rises, never falls below the base, never exceeds 20 (generated)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.boolean(),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 60 }),
        (base, research, perLevel, maxLevel, level) => {
          const rules = { base, research, perLevel, maxLevel };
          const now = planetLimit(rules, level)!;
          const next = planetLimit(rules, level + 1)!;
          expect(next).toBeGreaterThanOrEqual(now);
          expect(now).toBeGreaterThanOrEqual(base);
          expect(now).toBeLessThanOrEqual(MOST_PLANETS);
        },
      ),
    );
  });

  it('is read from the research of a player and from the universe`s round', () => {
    expect(colonyLevel({ colonial: 3, spy: 9 })).toBe(3);
    expect(colonyLevel({ spy: 9 })).toBe(0);
    expect(colonyLevel(undefined)).toBe(0);
    expect(limitFor(EXAMPLE, { colonial: 2 })).toBe(10);
    expect(limitFor(EXAMPLE, {})).toBe(6);
    expect(
      colonyRules({
        ...DEFAULT_UNIVERSE,
        roundColonyBase: 6,
        roundColonyResearch: 1,
        roundColonyPerLevel: 3,
        roundColonyMaxLevel: 0,
      }),
    ).toEqual({ base: 6, research: true, perLevel: 3, maxLevel: 0 });
  });
});

describe('the room under the limit', () => {
  it('counts the planets and the Landnahmen on their way: a launch needs fewer than the limit', () => {
    expect(limitReached(6, { owned: 5, flying: 0 })).toBe(false);
    expect(limitReached(6, { owned: 6, flying: 0 })).toBe(true);
    expect(limitReached(6, { owned: 4, flying: 1 })).toBe(false);
    expect(limitReached(6, { owned: 4, flying: 2 })).toBe(true);
    expect(limitReached(6, { owned: 7, flying: 0 })).toBe(true);
    expect(limitReached(null, { owned: 500, flying: 500 })).toBe(false);
  });

  it('asks only the planets at the arrival: the arriving fleet is no reservation, and a player over the limit is refused', () => {
    expect(arrivalBlocked(6, 5)).toBe(false);
    expect(arrivalBlocked(6, 6)).toBe(true);
    expect(arrivalBlocked(6, 8)).toBe(true);
    expect(arrivalBlocked(null, 40)).toBe(false);
  });
});

describe('the words of the limit [V]', () => {
  it('refuses a launch with the count, and suggests the research only when the round has it', () => {
    expect(limitText(6, { owned: 6, flying: 0 }, EXAMPLE)).toBe(
      'Planetengrenze erreicht (6/6). Erforsche Kolonialverwaltung oder gib eine Kolonie auf.',
    );
    expect(
      limitText(6, { owned: 5, flying: 1 }, { ...EXAMPLE, research: false }),
    ).toBe('Planetengrenze erreicht (6/6). Gib eine Kolonie auf.');
  });

  it('reports a failed arrival with the way home of ark and cargo', () => {
    expect(arrivalText(8)).toBe(
      'Planetengrenze erreicht (8/8). Deine Flotte kehrt mit der Kolonistenarche zurück.',
    );
  });

  it('shows the planets against the limit, with the research level when the round has it', () => {
    expect(limitLine(EXAMPLE, 6, 1)).toBe(
      'Planeten: 6 / 8 · Kolonialverwaltung Stufe 1',
    );
    expect(limitLine({ ...EXAMPLE, research: false }, 6, 3)).toBe(
      'Planeten: 6 / 6',
    );
    expect(limitLine({ ...EXAMPLE, base: 0 }, 3, 0)).toBe(
      'Planeten: 3 · unbegrenzt',
    );
  });
});

describe('the research Kolonialverwaltung in a round', () => {
  it('exists only with the switch on and a base limit to raise', () => {
    expect(researchOffered(EXAMPLE)).toBe(true);
    expect(researchOffered({ ...EXAMPLE, research: false })).toBe(false);
    expect(researchOffered({ ...EXAMPLE, base: 0 })).toBe(false);
  });

  it('cannot be started when the round does not have it, nor past the highest level; level 5 of 4 cannot start', () => {
    expect(
      researchRefused('colonial', { ...EXAMPLE, research: false }, 0),
    ).toBe('off');
    expect(researchRefused('colonial', EXAMPLE, 0)).toBeUndefined();
    expect(researchRefused('colonial', EXAMPLE, 3)).toBeUndefined();
    expect(researchRefused('colonial', EXAMPLE, 4)).toBe('maxLevel');
    expect(researchRefused('colonial', EXAMPLE, 5)).toBe('maxLevel');
  });

  it('has no ceiling of levels with a highest level of 0', () => {
    expect(
      researchRefused('colonial', { ...EXAMPLE, maxLevel: 0 }, 30),
    ).toBeUndefined();
  });

  it('says nothing about any other research', () => {
    expect(researchRefused('spy', { ...EXAMPLE, research: false }, 9)).toBe(
      undefined,
    );
  });
});

describe('the preview of the dialog „Neue Runde“ (#237) [V]', () => {
  it('lists the limits of the owner`s example: 6 / 8 / 10 / 12 / 14', () => {
    expect(colonyPreview(EXAMPLE)).toBe(
      'Vorschau: Ohne Forschung: 6 Planeten · Stufe 1: 8 · Stufe 2: 10 · Stufe 3: 12 · Stufe 4: 14.',
    );
  });

  it('says „Unbegrenzte Planetenanzahl“ for 0 without the research', () => {
    expect(colonyPreview({ ...EXAMPLE, base: 0, research: false })).toBe(
      'Vorschau: Unbegrenzte Planetenanzahl',
    );
  });

  it('names only the base limit without the research, in the singular for one planet', () => {
    expect(colonyPreview({ ...EXAMPLE, research: false })).toBe(
      'Vorschau: 6 Planeten',
    );
    expect(colonyPreview({ ...EXAMPLE, base: 1, research: false })).toBe(
      'Vorschau: 1 Planet',
    );
  });

  it('shows the refusal of the server for the research without a base limit', () => {
    expect(colonyPreview({ ...EXAMPLE, base: 0 })).toBe(
      'Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.',
    );
  });

  it('stops the levels where 20 planets are reached, also without a highest level', () => {
    expect(colonyPreview({ ...EXAMPLE, maxLevel: 0 })).toBe(
      'Vorschau: Ohne Forschung: 6 Planeten · Stufe 1: 8 · Stufe 2: 10 · Stufe 3: 12 · Stufe 4: 14 · Stufe 5: 16 · Stufe 6: 18 · Stufe 7: 20 · keine maximale Forschungsstufe.',
    );
    expect(colonyPreview({ ...EXAMPLE, maxLevel: 20 })).toBe(
      colonyPreview({ ...EXAMPLE, maxLevel: 0 }).replace(
        ' · keine maximale Forschungsstufe',
        '',
      ),
    );
  });

  it('writes a level the highest level stops before the cap with its own number', () => {
    expect(colonyPreview({ ...EXAMPLE, maxLevel: 1 })).toBe(
      'Vorschau: Ohne Forschung: 6 Planeten · Stufe 1: 8.',
    );
  });

  it('is empty while a value is outside its range or not a number', () => {
    for (const bad of [
      { base: Number.NaN },
      { base: 21 },
      { base: -1 },
      { perLevel: 0 },
      { perLevel: 21 },
      { maxLevel: 21 },
      { maxLevel: 1.5 },
    ])
      expect(colonyPreview({ ...EXAMPLE, ...bad }), JSON.stringify(bad)).toBe(
        '',
      );
  });

  it('is the line the group of the registry writes for the values of its fields', () => {
    const group = SETTINGS[0]!.group!;
    const values = {
      colonyBase: 6,
      colonyResearch: 1,
      colonyPerLevel: 2,
      colonyMaxLevel: 4,
    };
    expect(roundPreview(group, values)).toBe(colonyPreview(EXAMPLE));
    expect(roundPreview(group, { ...values, colonyResearch: 0 })).toBe(
      'Vorschau: 6 Planeten',
    );
  });
});

describe('the extra fields of the dialog show only with the research on (#237)', () => {
  const values = (research: number) => ({
    colonyBase: 6,
    colonyResearch: research,
    colonyPerLevel: 2,
    colonyMaxLevel: 4,
  });

  it('hides the planets per level and the highest level with the research off, and no other field', () => {
    expect(SETTINGS.map((s) => roundShown(s, values(0)))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(SETTINGS.map((s) => roundShown(s, values(1)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});

describe('the line of the research row (#237)', () => {
  it('reads „Kolonialverwaltung Stufe 3/4 · +2 Planeten je Stufe · nächste Stufe: maximal 14 Planeten“', () => {
    expect(researchLine(EXAMPLE, 3)).toBe(
      'Kolonialverwaltung Stufe 3/4 · +2 Planeten je Stufe · nächste Stufe: maximal 14 Planeten',
    );
    expect(researchLine(EXAMPLE, 0)).toBe(
      'Kolonialverwaltung Stufe 0/4 · +2 Planeten je Stufe · nächste Stufe: maximal 8 Planeten',
    );
  });

  it('says „keine maximale Forschungsstufe“ without a highest level', () => {
    expect(researchLine({ ...EXAMPLE, maxLevel: 0 }, 3)).toBe(
      'Kolonialverwaltung Stufe 3 · keine maximale Forschungsstufe · +2 Planeten je Stufe · nächste Stufe: maximal 14 Planeten',
    );
  });

  it('says that the highest level is reached, and counts one planet in the singular', () => {
    expect(researchLine(EXAMPLE, 4)).toBe(
      'Kolonialverwaltung Stufe 4/4 · +2 Planeten je Stufe · höchste Stufe erreicht',
    );
    expect(researchLine({ ...EXAMPLE, perLevel: 1 }, 1)).toContain(
      '+1 Planet je Stufe',
    );
  });

  it('never promises more than the 20 planets of the cap', () => {
    expect(researchLine({ ...EXAMPLE, maxLevel: 0 }, 9)).toContain(
      'nächste Stufe: maximal 20 Planeten',
    );
  });

  it('is a line of the Kolonialverwaltung only, and only in a round that has it', () => {
    const cfg = (research: number) =>
      ({
        ...DEFAULT_UNIVERSE,
        ...roundDefaults(),
        roundColonyBase: 6,
        roundColonyResearch: research,
        roundColonyPerLevel: 2,
        roundColonyMaxLevel: 4,
      }) as Parameters<typeof researchNote>[1];
    expect(researchNote('colonial', cfg(1), 3)).toBe(researchLine(EXAMPLE, 3));
    expect(researchNote('colonial', cfg(0), 3)).toBeNull();
    expect(researchNote('spy', cfg(1), 3)).toBeNull();
  });
});
