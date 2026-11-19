import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { V } from '../views/common.ts';
import { clientFeature } from './queue.ts';
import { fakeCtx } from './test-ctx.ts';

// What makes a count refused is tested with logic/catalog-list.ts.
const note = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../logic/catalog-list.ts', () => ({
  orderNote: vi.fn(() => note.value),
}));

let fields: Record<string, { value: string }>;

beforeEach(() => {
  fields = { '#q_fighter': { value: '12' } };
  note.value = null;
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
  });
  client.view = { P: {} } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.view = null;
});

describe('the buttons of the queues', () => {
  it('orders and cancels a building and a research by their key', () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    acts.build({ k: 'mine' });
    acts.cancelBuild();
    acts.research({ k: 'laser' });
    acts.cancelResearch();
    expect(vi.mocked(ctx.act).mock.calls).toEqual([
      ['build', { key: 'mine' }],
      ['cancelBuild'],
      ['research', { key: 'laser' }],
      ['cancelResearch'],
    ]);
  });

  it('fills the count field with the most that can be built, or 0', () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    acts.maxq({ k: 'fighter', max: '40' });
    acts.maxq({ k: 'fighter' });
    expect(ctx.setInput).toHaveBeenNthCalledWith(1, '#q_fighter', '40');
    expect(ctx.setInput).toHaveBeenNthCalledWith(2, '#q_fighter', 0);
  });
});

describe('ordering ships', () => {
  it('sends the count typed and empties the field once it went through here', async () => {
    const ctx = fakeCtx();
    await clientFeature.acts(ctx).order({ k: 'fighter' });
    expect(ctx.actHere).toHaveBeenCalledWith('order', {
      key: 'fighter',
      n: 12,
    });
    expect(ctx.setInput).toHaveBeenCalledWith('#q_fighter', '');
  });

  it('keeps the count when the order did not go through on this place', async () => {
    const ctx = fakeCtx({ actHere: vi.fn(async () => false) });
    await clientFeature.acts(ctx).order({ k: 'fighter' });
    expect(ctx.setInput).not.toHaveBeenCalled();
  });

  it('keeps a count within 0 and 1e9, an empty field as 0', async () => {
    const ctx = fakeCtx();
    fields['#q_fighter'] = { value: '99999999999' };
    await clientFeature.acts(ctx).order({ k: 'fighter' });
    expect(ctx.actHere).toHaveBeenLastCalledWith('order', {
      key: 'fighter',
      n: 1e9,
    });
    fields['#q_fighter'] = { value: '' };
    await clientFeature.acts(ctx).order({ k: 'fighter' });
    expect(ctx.actHere).toHaveBeenLastCalledWith('order', {
      key: 'fighter',
      n: 0,
    });
  });

  it('shows the refusal and sends nothing', async () => {
    const ctx = fakeCtx();
    note.value = 'Bitte eine Anzahl eingeben.';
    await clientFeature.acts(ctx).order({ k: 'fighter' });
    expect(ctx.toast).toHaveBeenCalledWith('Bitte eine Anzahl eingeben.', true);
    expect(ctx.actHere).not.toHaveBeenCalled();
  });
});
