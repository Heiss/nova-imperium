import { afterEach, describe, expect, it } from 'vitest';
import { forgetForms } from './form-state.svelte.ts';
import { isChosen, optionsForm } from './options-form.svelte.ts';

afterEach(forgetForms);

describe('the state of the forms of „Optionen“', () => {
  it('starts untouched and is dropped by a fresh render', () => {
    expect(optionsForm).toEqual({});
    Object.assign(optionsForm, { probes: '3', pwNext: 'x', report: 'y' });
    forgetForms();
    expect(optionsForm).toEqual({});
  });

  it('selects the option of the page until one is chosen, then only that one', () => {
    const on = { value: 'a', selected: true };
    const off = { value: 'b', selected: false };
    expect([isChosen(undefined, on), isChosen(undefined, off)]).toEqual([
      true,
      false,
    ]);
    expect([isChosen('b', on), isChosen('b', off)]).toEqual([false, true]);
    expect([isChosen('', on), isChosen('', off)]).toEqual([false, false]);
  });
});
