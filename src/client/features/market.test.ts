import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { planet, roundDefaults } from '../../test/fixtures.ts';
import { draft } from '../logic/market-form.svelte.ts';
import { newDraft } from '../logic/market.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from '../views/common.ts';
import { clientFeature } from './market.ts';
import { fakeCtx } from './test-ctx.ts';

const BASE = 1_000_000;
const PRICES = { mc: BASE, md: BASE, cm: BASE, cd: BASE, dm: BASE, dc: BASE };

type Submit = (e: {
  target: { id: string };
  preventDefault: () => void;
}) => void;
let submit: Submit;

const send = (id = 'marketform'): { prevented: boolean } => {
  const seen = { prevented: false };
  submit({
    target: { id },
    preventDefault: () => {
      seen.prevented = true;
    },
  });
  return seen;
};

beforeEach(() => {
  vi.stubGlobal('document', {
    addEventListener: (type: string, fn: Submit) => {
      if (type === 'submit') submit = fn;
    },
  });
  client.view = {
    s: {
      round: { ...roundDefaults(), number: 1 },
      cfg: { ...DEFAULT_UNIVERSE },
      market: { prices: PRICES, used: 0 },
    } as unknown as GameState,
    P: planet({ b: { market: 1 }, res: { m: 5000, c: 100, d: 0 } }),
  } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(draft, newDraft());
  client.view = null;
});

describe('„Tauschen“', () => {
  it('sends what the form holds, and clears the amount once it went through', async () => {
    const ctx = fakeCtx();
    clientFeature.listen!(ctx);
    Object.assign(draft, { give: 'm', get: 'd', amount: '1000' });
    expect(send().prevented).toBe(true);
    expect(ctx.act).toHaveBeenCalledWith('trade', {
      give: 'm',
      get: 'd',
      amount: 1000,
    });
    await vi.waitFor(() => expect(draft.amount).toBe(''));
    expect(draft).toMatchObject({ give: 'm', get: 'd' });
  });

  it('sends an empty amount as none, and what to get is never what is given', () => {
    const ctx = fakeCtx();
    clientFeature.listen!(ctx);
    Object.assign(draft, { give: 'c', get: 'c' });
    send();
    expect(ctx.act).toHaveBeenCalledWith('trade', {
      give: 'c',
      get: 'm',
      amount: null,
    });
  });

  it('keeps the amount when the server refused', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    clientFeature.listen!(ctx);
    draft.amount = '77';
    send();
    await Promise.resolve();
    await Promise.resolve();
    expect(draft.amount).toBe('77');
  });

  it('ignores the submit of another form', () => {
    const ctx = fakeCtx();
    clientFeature.listen!(ctx);
    expect(send('passwordform').prevented).toBe(false);
    expect(ctx.act).not.toHaveBeenCalled();
  });
});

describe('„max“', () => {
  it('puts the most that can be given into the amount', () => {
    Object.assign(draft, { give: 'm', get: 'c', amount: '1' });
    clientFeature.acts().marketMax();
    expect(draft.amount).toBe('5000');
  });

  it('empties the amount when nothing can be given, and does nothing without a state', () => {
    Object.assign(draft, { give: 'd', get: 'c', amount: '9' });
    clientFeature.acts().marketMax();
    expect(draft.amount).toBe('');
    draft.amount = '9';
    client.view = null;
    clientFeature.acts().marketMax();
    expect(draft.amount).toBe('9');
  });
});
