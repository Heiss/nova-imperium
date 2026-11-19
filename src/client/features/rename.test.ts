import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { V } from '../views/common.ts';
import { clientFeature } from './rename.ts';
import { fakeCtx } from './test-ctx.ts';

let field: { value: string };

beforeEach(() => {
  field = { value: '  Neuer Name ' };
  vi.stubGlobal('document', {
    querySelector: (sel: string) => (sel === '#rn' ? field : null),
  });
  client.view = { P: { kind: 'planet', name: 'Alt <1>' } } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.view = null;
});

describe('renaming a planet or a moon', () => {
  it('opens a dialog with the escaped name of a planet', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).rename();
    const html = vi.mocked(ctx.modal).mock.calls[0]![0];
    expect(html).toContain('<b>Planet umbenennen</b>');
    expect(html).toContain('value="Alt &lt;1&gt;"');
    expect(html).toContain('data-act="doRename"');
  });

  it('names a moon as one', () => {
    client.view!.P.kind = 'moon';
    const ctx = fakeCtx();
    clientFeature.acts(ctx).rename();
    expect(vi.mocked(ctx.modal).mock.calls[0]![0]).toContain(
      '<b>Mond umbenennen</b>',
    );
  });

  it('closes the dialog and sends the trimmed name', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).doRename();
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.act).toHaveBeenCalledWith('rename', { name: 'Neuer Name' });
  });

  it('closes the dialog and sends nothing for an empty name', () => {
    field.value = '   ';
    const ctx = fakeCtx();
    clientFeature.acts(ctx).doRename();
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.act).not.toHaveBeenCalled();
  });
});
