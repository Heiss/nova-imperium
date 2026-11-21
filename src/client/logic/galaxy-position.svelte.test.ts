import { afterEach, describe, expect, it } from 'vitest';
import { forgetForms } from './form-state.svelte.ts';
import { galaxyPosition, shown, wanted } from './galaxy-position.svelte.ts';

afterEach(forgetForms);

const page = { gal: 2, sys: 5 };
const universe = { galaxies: 4, systems: 10 };

describe('the position typed into the Sternenkarte', () => {
  it('starts with no typed field and is dropped by a fresh render', () => {
    expect(galaxyPosition).toEqual({ gal: null, sys: null });
    galaxyPosition.gal = '1';
    galaxyPosition.sys = '';
    forgetForms();
    expect(galaxyPosition).toEqual({ gal: null, sys: null });
  });

  it('shows what was typed, even the empty text, else the page', () => {
    expect(shown(null, 7)).toBe('7');
    expect(shown('12', 7)).toBe('12');
    expect(shown('', 7)).toBe('');
  });

  it('asks for the page where nothing was typed', () => {
    expect(wanted(galaxyPosition, page, universe)).toEqual(page);
  });

  it('takes what was typed, kept inside the universe from 1', () => {
    expect(wanted({ gal: '3', sys: '8' }, page, universe)).toEqual({
      gal: 3,
      sys: 8,
    });
    expect(wanted({ gal: '9', sys: '0' }, page, universe)).toEqual({
      gal: 4,
      sys: 1,
    });
    expect(wanted({ gal: '', sys: '99' }, page, universe)).toEqual({
      gal: 1,
      sys: 10,
    });
  });

  it('reads each field on its own', () => {
    expect(wanted({ gal: '3', sys: null }, page, universe)).toEqual({
      gal: 3,
      sys: 5,
    });
    expect(wanted({ gal: null, sys: '8' }, page, universe)).toEqual({
      gal: 2,
      sys: 8,
    });
  });
});
