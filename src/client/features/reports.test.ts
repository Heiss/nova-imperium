import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { clientFeature } from './reports.ts';
import { fakeCtx } from './test-ctx.ts';

const toggle = vi.fn();
beforeEach(() => {
  client.ui.openRep = {};
  toggle.mockClear();
  vi.stubGlobal('document', {
    getElementById: (id: string) =>
      id === 'rep_r1' ? { classList: { toggle } } : null,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the buttons of the list of reports', () => {
  it('opens a report and closes it again, with its box on the page', () => {
    const { toggleRep } = clientFeature.acts(fakeCtx());
    toggleRep({ id: 'r1' });
    expect(client.ui.openRep).toEqual({ r1: true });
    expect(toggle).toHaveBeenCalledWith('open');
    toggleRep({ id: 'r1' });
    expect(client.ui.openRep).toEqual({ r1: false });
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it('remembers a report whose box is not on the page', () => {
    clientFeature.acts(fakeCtx()).toggleRep({ id: 'r2' });
    expect(client.ui.openRep).toEqual({ r2: true });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('deletes one report or all of them', () => {
    const ctx = fakeCtx();
    const { delrep, delall } = clientFeature.acts(ctx);
    delrep({ id: 'r1' });
    delall();
    expect(ctx.act).toHaveBeenNthCalledWith(1, 'delrep', { id: 'r1' });
    expect(ctx.act).toHaveBeenNthCalledWith(2, 'delall');
  });
});
