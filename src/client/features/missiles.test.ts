// The handlers of „Verschrotten“ of stored missiles (#54, 2026-11-21): the amount
// typed in the row is checked as the server checks it, a confirmation opens,
// its button sends the order and empties the field.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { V } from '../views/common.ts';
import { tearDownDialog } from '../views/missiles.ts';
import { clientFeature } from './missiles.ts';
import { fakeCtx } from './test-ctx.ts';

let fields: Record<string, { value: string }>;

beforeEach(() => {
  fields = { '#td_abm': { value: '3' } };
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
  });
  client.view = { P: { def: { abm: 4, ipm: 2 } } } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.view = null;
});

describe('„Verschrotten“ of stored missiles', () => {
  it('opens the confirmation with the amount typed', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).tearDown!({ k: 'abm' });
    expect(ctx.modal).toHaveBeenCalledWith(tearDownDialog('abm', 3));
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('opens it for exactly the stock', () => {
    fields['#td_abm']!.value = '4';
    const ctx = fakeCtx();
    clientFeature.acts(ctx).tearDown!({ k: 'abm' });
    expect(ctx.modal).toHaveBeenCalledWith(tearDownDialog('abm', 4));
  });

  it('shows the note of the check instead, and opens nothing', () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    for (const [value, note] of [
      ['5', 'Nicht so viele Raketen vorhanden.'],
      ['0', 'Bitte eine Anzahl eingeben.'],
      ['', 'Bitte eine Anzahl eingeben.'],
      ['1.5', 'Bitte eine Anzahl eingeben.'],
    ] as const) {
      fields['#td_abm']!.value = value;
      vi.mocked(ctx.toast).mockClear();
      acts.tearDown!({ k: 'abm' });
      expect(ctx.toast, value).toHaveBeenCalledWith(note, true);
    }
    // A field that is not there reads as no amount.
    acts.tearDown!({ k: 'ipm' });
    expect(ctx.toast).toHaveBeenLastCalledWith(
      'Bitte eine Anzahl eingeben.',
      true,
    );
    expect(ctx.modal).not.toHaveBeenCalled();
  });

  it('does nothing without a shown view', () => {
    client.view = null;
    const ctx = fakeCtx();
    clientFeature.acts(ctx).tearDown!({ k: 'abm' });
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('sends the order, closes the dialog and empties the field once it went through', async () => {
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).doTearDown!({ k: 'abm', n: '3' });
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.actHere).toHaveBeenCalledWith('tearDownMissiles', {
      key: 'abm',
      n: 3,
    });
    expect(ctx.setInput).toHaveBeenCalledWith('#td_abm', '');
  });

  it('keeps the amount when the server refuses', async () => {
    const ctx = fakeCtx({ actHere: vi.fn(async () => false) });
    await clientFeature.acts(ctx).doTearDown!({ k: 'abm', n: '3' });
    expect(ctx.setInput).not.toHaveBeenCalled();
  });
});
