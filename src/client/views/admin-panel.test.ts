import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminTabKey,
  forgetAdminPanel,
  refreshInvitations,
} from './admin-panel.ts';

let tabs: Record<string, { focus: () => void }>;

beforeEach(() => {
  tabs = {};
  vi.stubGlobal('document', {
    querySelector: (sel: string) => tabs[sel] ?? null,
  });
  forgetAdminPanel();
});
afterEach(() => vi.unstubAllGlobals());

/** A key pressed on `target`, which is a tab when it has a `data-tab`. */
function press(key: string, tab = true) {
  const event = {
    key,
    preventDefault: vi.fn(),
    target: { closest: () => (tab ? {} : null) },
  };
  adminTabKey(event as unknown as KeyboardEvent);
  return event;
}

describe('the arrow keys on the tabs of the page', () => {
  it('move to the next tab and focus it, the first one being „Ereignisprotokoll“', () => {
    const focus = vi.fn();
    tabs['#admin-tab-players'] = { focus };
    const event = press('ArrowRight');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('go round: left from the first tab to the last, Home to the first, End to the last', () => {
    for (const [key, tab] of [
      ['ArrowLeft', 'announce'],
      ['End', 'announce'],
      ['Home', 'events'],
    ] as const) {
      const focus = vi.fn();
      tabs[`#admin-tab-${tab}`] = { focus };
      press(key);
      expect(focus, key).toHaveBeenCalled();
    }
  });

  it('leave every other key and every other element alone', () => {
    const focus = vi.fn();
    tabs['#admin-tab-players'] = { focus };
    expect(press('a').preventDefault).not.toHaveBeenCalled();
    expect(press('ArrowRight', false).preventDefault).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });
});

describe('the list of the invitations', () => {
  it('is not loaded while no panel is shown', () => {
    expect(() => refreshInvitations()).not.toThrow();
  });
});
