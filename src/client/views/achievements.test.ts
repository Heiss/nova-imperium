// The achievements page (#189, the phone view): the groups „Offen“ and
// „Erledigt“ can be unfolded, and every entry that is not the next goal of its
// series is marked, so the phone hides it. The desktop shows all, so the
// markup keeps every entry. As the component Achievements renders it
// (#118, bundle 5), the markup as a browser shows it.
import { afterEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../core/achievements.ts';
import { achievementsView } from '../../test/achievements-view.ts';
import { normalize } from '../../test/markup.ts';
import { unfolded } from '../logic/achievement-fold.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';

const first = ACHIEVEMENTS[0]!;
const second = ACHIEVEMENTS[1]!;

function page(claimed: string[] = [], progress: Record<string, number> = {}) {
  const v = {
    s: {
      round: { achievements: true, daily: false },
      achievements: { progress, claimed, daily: null },
    } as unknown as GameState,
  } as unknown as V;
  return normalize(achievementsView(v));
}

afterEach(() => {
  unfolded.open = false;
  unfolded.claimed = false;
});

describe('the achievements page on a phone', () => {
  it('keeps every entry in the markup', () => {
    expect(page().match(/<article data-achievement/g)).toHaveLength(
      ACHIEVEMENTS.length,
    );
  });

  it('marks the entries after the first of a series as later', () => {
    const out = page();
    // The first of a series is the next goal, the second is later.
    expect(
      out.match(
        /<article data-achievement data-category="[a-z]+" data-search/g,
      )!.length,
    ).toBe(new Set(ACHIEVEMENTS.map((a) => a.metric)).size);
    expect(first.metric).toBe(second.metric);
    expect(out).toContain('data-later data-search=');
  });

  it('makes the next one of a series the goal once the first is claimed', () => {
    const before = page().match(/data-later/g)!.length;
    const after = page([first.id]).match(/data-later/g)!.length;
    expect(after).toBe(before - 1);
  });

  it('folds „Offen“ and „Erledigt“ with a button for each, „Einlösbar“ stays open', () => {
    const out = page([first.id], { [second.metric]: second.target });
    expect(out).toContain('<section data-achievement-group data-fold="open">');
    expect(out).toContain(
      '<section data-achievement-group data-fold="claimed">',
    );
    expect(out).toMatch(
      /aria-expanded="false" class="fold-all phone-only" data-act="achFold" data-g="open" type="button">Alle \d+ zeigen</,
    );
    expect(out).toContain(
      'aria-expanded="false" class="fold-all phone-only" data-act="achFold" data-g="claimed" type="button">1 erledigte zeigen<',
    );
    // The ready group has no fold.
    expect(out.match(/data-fold=/g)).toHaveLength(2);
  });

  it('marks a group the player unfolded, and has no button for an empty one', () => {
    unfolded.open = true;
    const out = page();
    expect(out).toContain(
      '<section data-achievement-group data-all data-fold="open">',
    );
    expect(out).toMatch(
      /aria-expanded="true"[^>]*>Nur die nächsten Ziele zeigen</,
    );
    // Nothing is claimed: no button, no fold for „Erledigt“.
    expect(out).not.toContain('data-g="claimed"');
    expect(out).not.toContain('data-fold="claimed"');
  });
});
