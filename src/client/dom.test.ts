import { afterEach, describe, expect, it, vi } from 'vitest';
import { byId, keepChatScroll, setById, setField, val } from './dom.ts';

afterEach(() => vi.unstubAllGlobals());

describe('reading and writing a field', () => {
  it('reads by selector or id, and gives the empty string for a missing field', () => {
    vi.stubGlobal('document', {
      querySelector: (s: string) => (s === '#a' ? { value: 'x' } : null),
      getElementById: (id: string) => (id === 'b' ? { value: 'y' } : null),
    });
    expect(val('#a')).toBe('x');
    expect(val('#none')).toBe('');
    expect(byId('b')).toBe('y');
    expect(byId('none')).toBe('');
  });

  it('writes only a field that is there', () => {
    const field = { value: '' };
    vi.stubGlobal('document', {
      getElementById: (id: string) => (id === 'b' ? field : null),
    });
    setById('b', 'z');
    setById('none', 'q');
    expect(field.value).toBe('z');
  });

  it('checks a checkbox by „true“ and unchecks it otherwise, its value unchanged (#441)', () => {
    const box = { type: 'checkbox', value: 'on', checked: false };
    setField(box as unknown as HTMLInputElement, 'true');
    expect(box).toEqual({ type: 'checkbox', value: 'on', checked: true });
    setField(box as unknown as HTMLInputElement, 'false');
    expect(box.checked).toBe(false);
    const text = { type: 'number', value: '1', checked: false };
    setField(text as unknown as HTMLInputElement, 'true');
    expect(text).toEqual({ type: 'number', value: 'true', checked: false });
  });
});

describe('the place of the chat log', () => {
  const root = (log: Record<string, number> | null) => {
    const el = log ? { ...log } : null;
    return {
      el,
      node: { querySelector: () => el } as unknown as ParentNode,
    };
  };

  it('stays where it was when the reader had scrolled up', () => {
    const { el, node } = root({
      scrollTop: 10,
      clientHeight: 100,
      scrollHeight: 500,
    });
    const restore = keepChatScroll(node);
    el!.scrollTop = 0;
    restore();
    expect(el!.scrollTop).toBe(10);
  });

  it('follows the end when the reader was at it, within 4 pixels', () => {
    const { el, node } = root({
      scrollTop: 396,
      clientHeight: 100,
      scrollHeight: 500,
    });
    const restore = keepChatScroll(node);
    el!.scrollHeight = 600;
    restore();
    expect(el!.scrollTop).toBe(600);
  });

  it('is not at the end 5 pixels above it', () => {
    const { el, node } = root({
      scrollTop: 395,
      clientHeight: 100,
      scrollHeight: 500,
    });
    const restore = keepChatScroll(node);
    el!.scrollHeight = 600;
    restore();
    expect(el!.scrollTop).toBe(395);
  });

  it('goes to the end when asked to, and does nothing without a log', () => {
    const { el, node } = root({
      scrollTop: 0,
      clientHeight: 100,
      scrollHeight: 500,
    });
    keepChatScroll(node, true)();
    expect(el!.scrollTop).toBe(500);
    expect(() => keepChatScroll(root(null).node)()).not.toThrow();
  });
});
