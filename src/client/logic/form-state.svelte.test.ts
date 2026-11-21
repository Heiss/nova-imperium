import { afterEach, describe, expect, it } from 'vitest';
import { forgetForms, formState } from './form-state.svelte.ts';

const form = formState(() => ({ name: '', n: 1 }));
const rows = formState((): Record<string, string> => ({}));

afterEach(forgetForms);

describe('the state of a form', () => {
  it('starts with the values of its start function', () => {
    expect(form).toEqual({ name: '', n: 1 });
    expect(rows).toEqual({});
  });

  it('is dropped by forgetForms: fields back to the start, rows gone', () => {
    form.name = 'Anna';
    form.n = 5;
    rows.a = 'x';
    rows.b = 'y';
    forgetForms();
    expect(form).toEqual({ name: '', n: 1 });
    expect(rows).toEqual({});
  });

  it('keeps every state apart: each is put back to its own start', () => {
    const other = formState(() => ({ on: true }));
    other.on = false;
    form.name = 'Berta';
    forgetForms();
    expect(other.on).toBe(true);
    expect(form.name).toBe('');
  });
});
