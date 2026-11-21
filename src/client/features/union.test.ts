// The handlers of the attack union (#225): opening a union, inviting a player
// by name, and joining by „Beitreten“ or by the choice „Verband“ of the fleet
// form, which fills in the target and the mission of the union.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState, UnionState } from '../logic/types.ts';
import type { V } from '../views/common.ts';
import type { Handler } from './contract.ts';
import { clientFeature } from './union.ts';
import { fakeCtx } from './test-ctx.ts';

const union = (over: Partial<UnionState> = {}): UnionState => ({
  id: 'f1',
  leader: 'u1',
  to: 'p1_4_8',
  toC: { g: 1, s: 4, p: 8 },
  arr: 100_000,
  fleets: [{ id: 'f1', owner: 'u1' }],
  invited: [],
  ...over,
});

let listeners: Record<string, (e: unknown) => void>;
const input = vi.fn();

beforeEach(() => {
  listeners = {};
  input.mockClear();
  // The name typed into the field of the union f1 (#332: the state of the fleet form).
  fleetForm.invite.f1 = '  Bert ';
  vi.stubGlobal(
    'Event',
    class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  );
  vi.stubGlobal('document', {
    getElementById: (id: string) =>
      id === 't_g' ? { dispatchEvent: input } : null,
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
  });
  client.ui.union = null;
  client.ui.ft = null;
  client.ui.fm = 'transport';
  client.view = {
    s: {
      me: { id: 'u1' },
      players: { u1: { name: 'Anna' } },
      unions: [
        union(),
        union({ id: 'f2', to: 'm1_2_3', toC: { g: 1, s: 2, p: 3 } }),
      ],
      round: {},
    } as unknown as GameState,
  } as unknown as V;
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetForms();
  client.view = null;
});

const acts = (ctx = fakeCtx()): Record<string, Handler> => {
  clientFeature.listen!(ctx);
  return clientFeature.acts(ctx);
};

describe('opening and inviting', () => {
  it('opens the union of a fleet by its id', () => {
    const ctx = fakeCtx();
    acts(ctx).openUnion!({ id: 'f1' });
    expect(ctx.act).toHaveBeenCalledExactlyOnceWith('openUnion', { id: 'f1' });
  });
  it('invites the player named in the field of the union, trimmed, and empties the field', async () => {
    const ctx = fakeCtx();
    await acts(ctx).inviteUnion!({ id: 'f1' });
    expect(ctx.act).toHaveBeenCalledExactlyOnceWith('inviteUnion', {
      id: 'f1',
      name: 'Bert',
    });
    expect(fleetForm.invite.f1).toBe('');
  });
  it('keeps the name when the invitation was refused, and sends nothing without a name', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    await acts(ctx).inviteUnion!({ id: 'f1' });
    expect(fleetForm.invite.f1).toBe('  Bert ');
    fleetForm.invite.f1 = '   ';
    await acts(ctx).inviteUnion!({ id: 'f1' });
    expect(ctx.act).toHaveBeenCalledTimes(1);
  });
});

describe('joining', () => {
  it('fills the fleet form with the target and a Sturmangriff and calculates again', () => {
    const ctx = fakeCtx();
    acts(ctx).joinUnion!({ id: 'f1' });
    expect(client.ui).toMatchObject({
      union: 'f1',
      ft: { g: 1, s: 4, p: 8, kind: 'planet' },
      fm: 'attack',
    });
    expect(fleetForm.to).toEqual({ g: '1', s: '4', p: '8' });
    expect(fleetForm.kind).toBe('planet');
    expect(fleetForm.mission).toBe('attack');
    expect(ctx.setInput).toHaveBeenCalledExactlyOnceWith('#t_u', 'f1');
    expect(input).toHaveBeenCalledTimes(1);
  });
  it('aims at the moon of a union that flies to a moon', () => {
    const ctx = fakeCtx();
    acts(ctx).joinUnion!({ id: 'f2' });
    expect(client.ui.ft).toEqual({ g: 1, s: 2, p: 3, kind: 'moon' });
    expect(fleetForm.kind).toBe('moon');
  });
  it('does the same when the choice of the form changes', () => {
    const ctx = fakeCtx();
    acts(ctx);
    listeners.change!({ target: { id: 't_u', value: 'f1' } });
    expect(client.ui).toMatchObject({ union: 'f1', fm: 'attack' });
    expect(fleetForm.to).toEqual({ g: '1', s: '4', p: '8' });
    listeners.change!({ target: { id: 't_u', value: 'f2' } });
    expect(client.ui.union).toBe('f2');
    expect(fleetForm.kind).toBe('moon');
  });
  it('forgets the union when „Kein Verband“ is chosen, and ignores every other field', () => {
    const ctx = fakeCtx();
    acts(ctx);
    client.ui.union = 'f1';
    listeners.change!({ target: { id: 't_u', value: '' } });
    expect(client.ui.union).toBeNull();
    client.ui.union = 'f1';
    listeners.change!({ target: { id: 't_m', value: 'transport' } });
    expect(client.ui.union).toBe('f1');
    expect(ctx.setInput).not.toHaveBeenCalled();
  });
  it('forgets a union that is not there any more and writes nothing', () => {
    const ctx = fakeCtx();
    acts(ctx).joinUnion!({ id: 'gone' });
    expect(client.ui.union).toBeNull();
    expect(client.ui.ft).toBeNull();
    expect(ctx.setInput).not.toHaveBeenCalled();
    expect(fleetForm.to).toEqual({ g: null, s: null, p: null });
    expect(fleetForm.kind).toBeNull();
    acts(ctx).joinUnion!({});
    expect(ctx.setInput).not.toHaveBeenCalled();
  });
});
