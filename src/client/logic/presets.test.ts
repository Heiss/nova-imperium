// The open question of a preset (#441): none before an admin clicks one.
import { expect, it } from 'vitest';
import { presetAsk } from './presets.svelte.ts';

it('has no open question of a preset at the start (#441)', () => {
  expect(presetAsk).toEqual({ place: null, id: null });
});
