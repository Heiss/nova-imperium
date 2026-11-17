// The guards of the Lexicanum (#285, „How to build it“, 5): a new entry, a
// new mission or a changed rule shows up in the Lexicanum or turns the CI
// red. Every catalog entry and mission has an article; no link without a
// target; no typed number in a text outside a formula; every value filled;
// every formula agrees with its rule.
import { describe, expect, it } from 'vitest';
import { classicIn } from '../../test/naming.ts';
import { BUILD, DEF, RES, SHIPS } from '../catalog.ts';
import { MISSION } from '../missions.ts';
import { U } from '../../test/fixtures.ts';
import {
  ARTICLES,
  article,
  KIND_TITLES,
  KINDS,
  missionArticle,
  requirementsOf,
  titleOf,
  usedFor,
} from './articles.ts';
import { hasEffect, partTexts, searchDocs } from './docs.ts';
import { fill, linkTargets, valueNames } from './links.ts';
import type { Block, LexState } from './types.ts';

/** States the computed blocks are checked on. */
const STATES: LexState[] = [
  { u: U, research: {}, ships: {} },
  { u: U, research: { spy: 4 }, ships: { probe: 12 } },
  { u: U, research: { spy: 9 }, ships: { probe: 400 } },
];

const blocksOf = (id: string): Block[] =>
  STATES.flatMap((s) => article(id)!.lexicon.blocks?.(s) ?? []);

/** Every text an article of stage 1 adds itself, with its values. */
const texts = ARTICLES.flatMap((a) => [
  ...(a.lexicon.texts ?? []).map((t) => ({ id: a.id, ...t })),
  ...blocksOf(a.id).flatMap((b) =>
    b.t === 'text'
      ? [{ id: a.id, text: b.text, values: {} as Record<string, string> }]
      : [],
  ),
]);

describe('the articles of stage 1 (#285)', () => {
  it('has an article for every catalog entry and every mission, each id once', () => {
    const keys = [BUILD, RES, SHIPS, DEF].flatMap((t) => Object.keys(t));
    expect(keys.length).toBeGreaterThanOrEqual(52);
    for (const key of keys) expect(article(key)?.key).toBe(key);
    for (const m of Object.keys(MISSION))
      expect(article(missionArticle(m))).toMatchObject({
        kind: 'mission',
        key: m,
      });
    expect(ARTICLES).toHaveLength(keys.length + Object.keys(MISSION).length);
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
    expect(article('nope')).toBeUndefined();
    expect(titleOf('spy')).toBe('Auspex-Lehre');
    expect(titleOf('mission-spy')).toBe('Auspex-Erkundung');
  });

  it('takes name, abbreviation, short and long text of the catalog (#63)', () => {
    const spy = article('spy')!;
    expect(spy).toMatchObject({
      kind: 'research',
      title: 'Auspex-Lehre',
      ab: 'AU',
    });
    expect(spy.ds).toBeTruthy();
    expect(spy.lt).toMatch(/^Die Auspex-Lehre/);
    expect(KINDS.map((k) => KIND_TITLES[k])).toEqual([
      'Gebäude',
      'Forschung',
      'Schiffe',
      'Verteidigung',
      'Missionen',
    ]);
  });

  it('knows the requirements in both directions', () => {
    expect(requirementsOf('spy')).toEqual([{ id: 'lab', level: 3 }]);
    expect(usedFor('spy')).toContainEqual({ id: 'probe', level: 2 });
    for (const a of ARTICLES)
      for (const r of requirementsOf(a.key))
        if (a.kind !== 'mission')
          expect(usedFor(r.id)).toContainEqual({ id: a.id, level: r.level });
    expect(usedFor('nope')).toEqual([]);
  });

  it('links only to articles that exist (B7)', () => {
    const targets = [
      ...texts.flatMap((t) => linkTargets(t.text)),
      ...ARTICLES.flatMap((a) => a.lexicon.seeAlso ?? []),
    ];
    expect(targets.length).toBeGreaterThan(0);
    for (const id of targets) expect(article(id), id).toBeDefined();
  });

  it('types no number into a text and fills every value', () => {
    for (const t of texts) {
      expect(t.text, t.id).not.toMatch(/\d/);
      for (const name of valueNames(t.text))
        expect(t.values?.[name], `${t.id}: {${name}}`).toBeDefined();
      expect(fill(t.text, t.values)).not.toMatch(/\{\w+\}/);
    }
  });

  it('agrees with the rule in every formula (B8)', () => {
    let n = 0;
    for (const a of ARTICLES)
      for (const f of a.lexicon.formulas ?? []) {
        expect(fill(f.text, f.values), a.id).not.toMatch(/\{\w+\}/);
        for (const x of f.samples) {
          expect(f.fn(...x), `${a.id}: ${f.text} at ${x}`).toBeCloseTo(
            f.rule(...x),
            9,
          );
          n++;
        }
      }
    expect(n).toBeGreaterThan(30);
  });

  it('has finite effects for the levels a table shows', () => {
    for (const a of ARTICLES) {
      const e = a.lexicon.effect;
      if (!e) continue;
      expect(a.kind === 'building' || a.kind === 'research').toBe(true);
      for (let level = 1; level <= 30; level++)
        expect(Number.isFinite(e.at(level)), a.id).toBe(true);
      expect(hasEffect(a)).toBe(true);
    }
  });

  it('says no classic name in its texts, keywords and computed blocks', () => {
    const all = [
      ...texts.map((t) => t.text),
      ...ARTICLES.flatMap((a) => [
        ...(a.lexicon.keywords ?? []),
        ...partTexts(a),
        ...(a.lexicon.formulas ?? []).map((f) => f.text),
        ...(a.lexicon.effect ? [a.lexicon.effect.label] : []),
      ]),
      JSON.stringify(ARTICLES.flatMap((a) => blocksOf(a.id))),
    ];
    for (const text of all) expect(classicIn(text), text).toEqual([]);
  });

  it('gives the search one document per article', () => {
    const docs = searchDocs();
    expect(docs.map((d) => d.id)).toEqual(ARTICLES.map((a) => a.id));
    const spy = docs.find((d) => d.id === 'spy')!;
    expect(spy.keywords).toContain('ausspähen');
    expect(spy.text).toContain('Was die Stufen bringen');
    expect(spy.text).toContain('Auspex-Erkundung hat einen Auspex-Wert');
    expect(docs.find((d) => d.id === 'metal')!.text).not.toContain(
      'Was die Stufen bringen',
    );
    expect(docs.find((d) => d.id === 'mission-spy')).toMatchObject({
      title: 'Auspex-Erkundung',
      line: '',
    });
  });
});
