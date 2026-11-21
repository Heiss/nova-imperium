import { describe, expect, it } from 'vitest';
import { input } from './action-input.ts';

describe('the declaration of the input of an action', () => {
  it('is an empty object: only its type counts', () => {
    expect(input()).toEqual({});
    expect(input<{ id: string }>()).toEqual({});
  });
});
