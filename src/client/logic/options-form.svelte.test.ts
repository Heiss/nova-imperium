import { afterEach, describe, expect, it } from 'vitest';
import { forgetForms } from './form-state.svelte.ts';
import { optionsForm } from './options-form.svelte.ts';

afterEach(forgetForms);

describe('the state of the forms of „Optionen“', () => {
  it('starts untouched and is dropped by a fresh render', () => {
    expect(optionsForm).toEqual({});
    Object.assign(optionsForm, { probes: '3', pwNext: 'x', report: 'y' });
    forgetForms();
    expect(optionsForm).toEqual({});
  });
});
