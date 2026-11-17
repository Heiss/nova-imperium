// The guards of the Lexicanum (#285, „How to build it“, 5): a new entry, a
// new mission or a changed rule shows up in the Lexicanum or turns the CI
// red. Every catalog entry and mission has an article; no link without a
// target; no typed number in a text outside a formula; every value filled;
// every formula agrees with its rule. Since the owner's „Geklärt“ of
// 2026-11-17: every article has keywords, every mission its text, and every
// article with an effect, every store and every producing building its
// words before the formula.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classicIn } from '../../test/naming.ts';
import { BUILD, DEF, PRODUCTION, RES, SHIPS, STORAGE } from '../catalog.ts';
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
import { fill, linkTargets, plain, valueNames } from './links.ts';
import { fold } from './search.ts';
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

  it('has everyday keywords for every article, none a name it already has (B6)', () => {
    for (const a of ARTICLES) {
      const keywords = a.lexicon.keywords ?? [];
      expect(keywords.length, a.id).toBeGreaterThanOrEqual(2);
      expect(new Set(keywords).size, a.id).toBe(keywords.length);
      for (const k of keywords) {
        // One word each, as a player types it; the search matches its start.
        expect(k, a.id).toMatch(/^\p{L}+$/u);
        expect(fold(a.title), `${a.id}: ${k}`).not.toContain(fold(k));
        expect(classicIn(k), `${a.id}: ${k}`).toEqual([]);
      }
    }
    expect(article('spy')!.lexicon.keywords).toEqual(['ausspähen', 'Gegner']);
  });

  it('says in one text what happens when a mission arrives', () => {
    const docs = searchDocs();
    for (const m of Object.keys(MISSION)) {
      const a = article(missionArticle(m))!;
      expect(a.lexicon.texts, m).toHaveLength(1);
      const text = partTexts(a)[0]!;
      expect(text, m).toMatch(/^Am (Ziel|Trümmerfeld)[ ,]/);
      expect(text.length, m).toBeGreaterThan(80);
      // The text is the line below the hit of the search, without link marks.
      const doc = docs.find((d) => d.id === a.id)!;
      expect(doc.line).toBe(text);
      expect(doc.line).not.toMatch(/\[\[|\{/);
      expect(doc.text).toContain(text);
      expect(hasEffect(a)).toBe(false);
      expect(a.lexicon.effect ?? a.lexicon.formulas).toBeUndefined();
    }
    expect(
      plain(article('mission-harvest')!.lexicon.texts![0]!.text, titleOf),
    ).toContain('nicht nur der Bergungsbarken');
  });

  it('has words before the formula wherever a level brings something', () => {
    const stores = STORAGE.map((s) => s.key);
    const producers = PRODUCTION.filter((p) => p.kind === 'building').map(
      (p) => p.key,
    );
    expect(stores).toHaveLength(3);
    expect(producers.length).toBeGreaterThanOrEqual(5);
    const need = ARTICLES.filter(
      (a) =>
        a.lexicon.effect ||
        a.lexicon.formulas ||
        a.lexicon.blocks ||
        stores.includes(a.key) ||
        (producers.includes(a.key) && a.kind === 'building'),
    );
    // Auspex-Lehre, Kogitator-Doktrin, the drives, weapons, shields and
    // armour, Sternennetz, Phalanx, Mondzitadelle, the stores, the producers.
    expect(need.length).toBeGreaterThanOrEqual(19);
    for (const a of need) {
      expect(a.lexicon.texts?.length, a.id).toBeGreaterThanOrEqual(1);
      for (const text of partTexts(a)) {
        expect(text.length, a.id).toBeGreaterThan(120);
        expect(text, a.id).not.toMatch(/\{\w+\}|\[\[/);
      }
    }
    // The values of a text are numbers of the rules, not words.
    expect(partTexts(article('computer')!)[0]).toContain(
      'Mit Stufe 5 sind es 6 Flotten',
    );
    expect(partTexts(article('phalanx')!)[0]).toContain(
      'Stufe 3 reicht 8 Systeme in jede Richtung, Stufe 5 schon 24.',
    );
    expect(partTexts(article('moonbase')!)[0]).toContain(
      'bringt 3 Felder und belegt selbst 1 davon – für andere Gebäude bleiben je Stufe 2',
    );
    expect(partTexts(article('ifn')!)[0]).toContain(
      '3 Scholarien der Stufe 12 forschen mit Stufe 2 des Sternennetzes wie eines der Stufe 36',
    );
    expect(partTexts(article('fusion')!)[0]).toContain(
      'ohne Machina-Energetik 489 Energie, mit Machina-Energetik 10 schon 1.214',
    );
    expect(partTexts(article('metal')!)[0]).toContain(
      'Stufe 10 rund 3,2-mal so viel wie Stufe 5',
    );
  });

  it('lists every draft for the owner as the code has it (okf/features/lexicanum-texts.md)', () => {
    const list = readFileSync('okf/features/lexicanum-texts.md', 'utf8');
    const sections = new Map(
      list
        .split(/^### /m)
        .slice(1)
        .map((part) => [/\(`([\w-]+)`\)/.exec(part)![1]!, part] as const),
    );
    expect([...sections.keys()]).toEqual(ARTICLES.map((a) => a.id));
    for (const a of ARTICLES) {
      const part = sections.get(a.id)!;
      expect(part.startsWith(`${a.title} (`), a.id).toBe(true);
      expect(part, a.id).toContain(
        `* **[V]** Keywords: ${a.lexicon.keywords!.join(', ')}\n`,
      );
      // The Auspex-Lehre keeps the text of the study, which is no draft.
      const drafts = a.id === 'spy' ? [] : partTexts(a);
      for (const text of drafts) expect(part, a.id).toContain(`„${text}“`);
      expect(part.match(/„/g)?.length ?? 0, a.id).toBe(drafts.length);
    }
  });

  it('gives the search one document per article', () => {
    const docs = searchDocs();
    expect(docs.map((d) => d.id)).toEqual(ARTICLES.map((a) => a.id));
    const spy = docs.find((d) => d.id === 'spy')!;
    expect(spy.keywords).toContain('ausspähen');
    expect(spy.text).toContain('Was die Stufen bringen');
    expect(spy.text).toContain('Auspex-Erkundung hat einen Auspex-Wert');
    // A producer has its words now, and so the heading (owner, 2026-11-17).
    expect(docs.find((d) => d.id === 'metal')!.text).toContain(
      'Die Förderung wächst schneller als die Stufe',
    );
    const mission = docs.find((d) => d.id === 'mission-spy')!;
    expect(mission.title).toBe('Auspex-Erkundung');
    expect(mission.line).toMatch(/^Am Ziel entsteht ein Auspex-Bericht/);
    // A mission has no „Was die Stufen bringen“.
    expect(mission.text).not.toContain('Was die Stufen bringen');
    expect(docs.find((d) => d.id === 'robot')!.text).not.toContain(
      'Was die Stufen bringen',
    );
  });
});
