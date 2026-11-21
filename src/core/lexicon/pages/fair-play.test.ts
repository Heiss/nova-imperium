// The rule page „Fair spielen“ (#181, D5): the general rule, and the link to
// the page of the universe under „Siehe auch“.
import { describe, expect, it } from 'vitest';
import { page } from './fair-play.ts';

describe('the rule page „Fair spielen“ (#181)', () => {
  it('states the rule and links the page of the universe', () => {
    expect(page.id).toBe('rule-fair');
    expect(page.kind).toBe('rule');
    expect(page.seeAlso).toEqual(['rule-universe']);
    expect(JSON.stringify(page.sections())).toContain(
      'Das Spiel darf nicht von einer KI oder einem Programm bedient werden',
    );
  });
});
