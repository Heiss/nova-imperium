import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { clientFeature } from './admin.ts';
import { fakeCtx } from './test-ctx.ts';

// The markup of the dialog is tested with the views.
vi.mock('../views/misc.ts', () => ({
  endzeitDialog: (minutes: number) => `endzeit:${minutes}`,
}));

let fields: Record<string, { value: string; select?: () => void }>;
let listeners: Record<string, ((e: Event) => void)[]>;

beforeEach(() => {
  fields = {};
  listeners = {};
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
    getElementById: (id: string) => fields[`#${id}`] ?? null,
    addEventListener: (type: string, listener: (e: Event) => void) =>
      (listeners[type] ??= []).push(listener),
  });
  client.game = {
    me: { id: 'u_a' },
    round: { number: 1 },
    cfg: { speed: 5, systems: 40 },
    admin: {
      endzeit: { minutes: 90, done: false },
      specs: [{ key: 'speed' }, { key: 'systems' }],
    },
  } as unknown as GameState;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
});

const acts = (ctx = fakeCtx()) => clientFeature.acts(ctx);

describe('the Endzeit', () => {
  it('opens the dialog with the flight time of the round', () => {
    const ctx = fakeCtx();
    acts(ctx).endzeit();
    expect(ctx.modal).toHaveBeenCalledWith('endzeit:90');
  });

  it('sends the flight time typed and closes the dialog', () => {
    const ctx = fakeCtx();
    fields['#endzeit-minutes'] = { value: '120' };
    acts(ctx).doEndzeit();
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.act).toHaveBeenCalledWith('endzeit', { minutes: '120' });
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('refuses a flight time out of range without a request, in the words of the server', () => {
    const ctx = fakeCtx();
    fields['#endzeit-minutes'] = { value: '0' };
    acts(ctx).doEndzeit();
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.act).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.',
      true,
    );
  });

  it('refuses a second Endzeit in the round', () => {
    const ctx = fakeCtx();
    client.game!.admin!.endzeit.done = true;
    fields['#endzeit-minutes'] = { value: '120' };
    acts(ctx).doEndzeit();
    expect(ctx.act).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith(
      'In dieser Runde wurde die Endzeit schon eingeläutet.',
      true,
    );
  });
});

describe('the settings of the universe', () => {
  it('sends the value of each field of the specs', () => {
    const ctx = fakeCtx();
    fields['#set_speed'] = { value: '5' };
    fields['#set_systems'] = { value: '40' };
    acts(ctx).saveSettings();
    expect(ctx.act).toHaveBeenCalledWith('settings', {
      settings: { speed: '5', systems: '40' },
    });
  });
});

describe('the draft of the settings over a redraw', () => {
  /** The admin types `value` into the field of `key`; the field then shows it. */
  const type = (key: string, value: string, event = 'input'): void => {
    fields[`#set_${key}`] = { value };
    const target = { dataset: { setting: key }, value };
    for (const l of listeners[event] ?? []) l({ target } as unknown as Event);
  };
  /** The page is drawn again: the fields show the server's values. */
  const redraw = (): void => {
    fields['#set_speed'] = { value: '5' };
    fields['#set_systems'] = { value: '40' };
    clientFeature.afterRender();
  };

  it('puts what was typed back into the field after a redraw', () => {
    acts();
    type('speed', '7');
    redraw();
    expect(fields['#set_speed']!.value).toBe('7');
    expect(fields['#set_systems']!.value).toBe('40');
  });

  it('keeps the choice of a select, which reports a change', () => {
    acts();
    type('systems', '1', 'change');
    redraw();
    expect(fields['#set_systems']!.value).toBe('1');
  });

  it('is no draft when the field is set back to the value of the server', () => {
    acts();
    type('speed', '7');
    type('speed', '5');
    redraw();
    expect(fields['#set_speed']!.value).toBe('5');
  });

  it('ignores a field that is no setting', () => {
    acts();
    for (const l of listeners.input ?? []) {
      l({ target: { value: '7', dataset: {} } } as unknown as Event);
      l({ target: null } as unknown as Event);
    }
    redraw();
    expect(fields['#set_speed']!.value).toBe('5');
  });

  it('keeps the draft when the server refuses the settings', async () => {
    const handlers = acts(fakeCtx({ act: vi.fn(async () => false) }));
    type('speed', '101');
    expect(await handlers.saveSettings()).toBe(false);
    redraw();
    expect(fields['#set_speed']!.value).toBe('101');
  });

  it('shows the values of the server again once they are saved', async () => {
    const handlers = acts();
    type('speed', '7');
    expect(await handlers.saveSettings()).toBe(true);
    redraw();
    expect(fields['#set_speed']!.value).toBe('5');
  });

  it('drops the draft of another account or round', () => {
    acts();
    type('speed', '7');
    client.game!.round.number = 2;
    redraw();
    expect(fields['#set_speed']!.value).toBe('5');
  });

  it('does nothing outside the admin page', () => {
    acts();
    type('speed', '7');
    client.game!.admin = null;
    redraw();
    expect(fields['#set_speed']!.value).toBe('5');
    client.game = null;
    expect(() => clientFeature.afterRender()).not.toThrow();
  });
});

describe('copying the invitation link', () => {
  const writeText = vi.fn();
  beforeEach(() => {
    writeText.mockReset();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  it('selects the link, copies it and says so', async () => {
    const ctx = fakeCtx();
    const select = vi.fn();
    fields['#inv_link'] = { value: 'https://x/#invite=abc', select };
    await acts(ctx).copyLink();
    expect(select).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('https://x/#invite=abc');
    expect(ctx.toast).toHaveBeenCalledWith('Link kopiert.');
  });

  it('asks the player to copy it when the browser refuses', async () => {
    const ctx = fakeCtx();
    writeText.mockRejectedValueOnce(new Error('no'));
    fields['#inv_link'] = { value: 'l', select: vi.fn() };
    await acts(ctx).copyLink();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Bitte den markierten Link selbst kopieren.',
      true,
    );
  });

  it('does nothing without the link on the page', async () => {
    const ctx = fakeCtx();
    await acts(ctx).copyLink();
    expect(writeText).not.toHaveBeenCalled();
    expect(ctx.toast).not.toHaveBeenCalled();
  });
});
