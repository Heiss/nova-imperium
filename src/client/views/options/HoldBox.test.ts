// The checkbox „Keine Wachen annehmen“ as the page renders it (CodeRabbit on
// #455): the player's pending choice, not the older answer of the server.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { holdPart } from '../../logic/options/holding.ts';
import HoldBox from './HoldBox.svelte';

const checked = (holdsRefused: boolean, holdChoice?: boolean): boolean => {
  const page = holdPart({
    s: { round: { holdOn: 1 }, holdsRefused },
    now: 0,
    ui: holdChoice === undefined ? {} : { holdChoice },
  } as never);
  const { body } = render(HoldBox, { props: { page, section: 'game' } });
  const box = /<input[^>]*id="o_holds"[^>]*>/.exec(body)![0];
  return /\schecked/.test(box);
};

describe('the rendered checkbox „Keine Wachen annehmen“', () => {
  it('shows the server option without a pending choice', () => {
    expect(checked(true)).toBe(true);
    expect(checked(false)).toBe(false);
  });

  it('shows the pending choice while its save runs, whatever the server answered before', () => {
    expect(checked(true, false)).toBe(false);
    expect(checked(false, true)).toBe(true);
  });
});
