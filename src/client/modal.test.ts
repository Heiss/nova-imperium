// The dialog of the page: HTML or a component, and the component is taken
// down whenever the dialog closes or another opens (#118, bundle 6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Dialog, modal } from './modal.ts';

let inner: { innerHTML: string; replaceChildren: () => void };
let outer: {
  shown: boolean;
  classList: { toggle: (c: string, on: boolean) => void };
};

beforeEach(() => {
  inner = {
    innerHTML: '',
    replaceChildren: vi.fn(() => {
      inner.innerHTML = '';
    }),
  };
  outer = {
    shown: false,
    classList: {
      toggle: (cls, on) => {
        if (cls === 'show') outer.shown = on;
      },
    },
  };
  vi.stubGlobal('document', {
    querySelector: (sel: string) =>
      ({ '#modal': outer, '#modalIn': inner })[sel] ?? null,
  });
});
afterEach(() => {
  modal('');
  vi.unstubAllGlobals();
});

describe('the dialog', () => {
  it('shows HTML and closes with the empty string', () => {
    modal('<p>Hallo</p>');
    expect(inner.innerHTML).toBe('<p>Hallo</p>');
    expect(outer.shown).toBe(true);
    modal('');
    expect(inner.innerHTML).toBe('');
    expect(outer.shown).toBe(false);
  });

  it('mounts a component into the dialog and shows it', () => {
    const destroy = vi.fn();
    const dialog: Dialog = vi.fn((target) => {
      expect(target).toBe(inner);
      return destroy;
    });
    modal(dialog);
    expect(dialog).toHaveBeenCalledOnce();
    expect(outer.shown).toBe(true);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('takes the component down when the dialog closes', () => {
    const destroy = vi.fn();
    modal(() => destroy);
    modal('');
    expect(destroy).toHaveBeenCalledOnce();
    expect(outer.shown).toBe(false);
    modal('');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('takes the component down when another dialog opens, and empties the target first', () => {
    const first = vi.fn();
    const second = vi.fn();
    modal(() => first);
    inner.innerHTML = 'left by the first';
    modal(() => {
      expect(first).toHaveBeenCalledOnce();
      expect(inner.innerHTML).toBe('');
      return second;
    });
    modal('<p>HTML</p>');
    expect(second).toHaveBeenCalledOnce();
    expect(inner.innerHTML).toBe('<p>HTML</p>');
  });
});
