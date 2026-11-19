import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientFeature } from './options.ts';
import { fakeCtx } from './test-ctx.ts';

const fields: Record<string, { value: string }> = {};

beforeEach(() => {
  fields['#o_probes'] = { value: '3' };
  fields['#o_explain'] = { value: 'hidden' };
  fields['#o_levels'] = { value: 'always' };
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saving the options', () => {
  it('sends the probes, the „?“ and the level overview (#187)', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).saveopt();
    expect(ctx.act).toHaveBeenCalledWith('options', {
      probes: 3,
      explain: 'hidden',
      levelTable: 'always',
    });
  });

  it('keeps the probes in their bounds', () => {
    fields['#o_probes'] = { value: '-4' };
    const ctx = fakeCtx();
    clientFeature.acts(ctx).saveopt();
    expect(vi.mocked(ctx.act).mock.calls[0]![1]).toMatchObject({ probes: 1 });
  });
});
