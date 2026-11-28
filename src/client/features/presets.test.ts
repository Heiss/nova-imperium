// „Umstellen“ of a preset (#441, 237a): the dialog „Neue Runde“ gets the
// values of every entry, the tab „Universum“ those of the live entries only;
// each field reports its change like a typed one. Nothing is sent.
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUND_SETTINGS, roundFieldId } from '../../core/round.ts';
import { askPreset, presetAsk } from '../logic/presets.svelte.ts';
import { clientFeature, fillPreset } from './presets.ts';

type Field = {
  type: string;
  value: string;
  checked: boolean;
  dispatchEvent: ReturnType<typeof vi.fn>;
};
let fields: Record<string, Field>;

const field = (type = 'number', value = '999'): Field => ({
  type,
  value,
  checked: false,
  dispatchEvent: vi.fn(() => true),
});

beforeEach(() => {
  fields = {};
  vi.stubGlobal('document', {
    getElementById: (id: string) => fields[id] ?? null,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('„Umstellen“ in the dialog „Neue Runde“ (#441)', () => {
  it('fills every field of the registry with its default and reports it', () => {
    for (const s of ROUND_SETTINGS)
      fields[roundFieldId(s)] = field(
        s.kind === 'switch' ? 'checkbox' : 'number',
      );
    fillPreset('round', 'standard');
    for (const s of ROUND_SETTINGS) {
      const f = fields[roundFieldId(s)]!;
      if (s.kind === 'switch') expect(f.checked, s.key).toBe(s.def);
      else expect(f.value, s.key).toBe(String(s.def));
      expect(f.dispatchEvent).toHaveBeenCalledTimes(1);
      const event = f.dispatchEvent.mock.calls[0]![0] as Event;
      expect(event.type).toBe('input');
      expect(event.bubbles).toBe(true);
    }
  });

  it('skips a field that is not there, and an unknown preset', () => {
    const one = ROUND_SETTINGS.find((s) => s.kind === 'number')!;
    fields[roundFieldId(one)] = field();
    fillPreset('round', 'standard');
    expect(fields[roundFieldId(one)]!.value).toBe(String(one.def));
    fields[roundFieldId(one)] = field();
    fillPreset('round', 'nope');
    expect(fields[roundFieldId(one)]!.value).toBe('999');
  });
});

describe('„Umstellen“ in the tab „Universum“ (#441, 237a; owner, 2026-11-28)', () => {
  it('fills the base values of the universe with their defaults and the rows of the live entries', () => {
    for (const s of ROUND_SETTINGS) fields[`set_${s.key}`] = field();
    for (const key of ['speed', 'galaxies', 'startMetal', 'extraFields'])
      fields[`set_${key}`] = field();
    fillPreset('universe', 'standard');
    for (const s of ROUND_SETTINGS) {
      const f = fields[`set_${s.key}`]!;
      if (s.kind === 'number' && s.live)
        expect(f.value, s.key).toBe(String(s.def));
      else expect(f.value, s.key).toBe('999');
    }
    // The base values: the default of version 1 (speed 5, 2 galaxies).
    for (const key of ['speed', 'galaxies', 'startMetal', 'extraFields']) {
      expect(fields[`set_${key}`]!.value, key).toBe(
        String(DEFAULT_UNIVERSE[key as keyof typeof DEFAULT_UNIVERSE]),
      );
      expect(fields[`set_${key}`]!.dispatchEvent, key).toHaveBeenCalled();
    }
    expect(fields.set_speed!.value).toBe('5');
    expect(fields.set_galaxies!.value).toBe('2');
  });
});

describe('the handlers of the presets (#441)', () => {
  const acts = () => clientFeature.acts();

  it('asks for a known place and preset only', () => {
    acts().askPreset!({ place: 'round', id: 'standard' });
    expect(presetAsk).toEqual({ place: 'round', id: 'standard' });
    acts().cancelPreset!();
    expect(presetAsk).toEqual({ place: null, id: null });
    acts().askPreset!({ place: 'elsewhere', id: 'standard' });
    acts().askPreset!({ place: 'round', id: 'nope' });
    expect(presetAsk).toEqual({ place: null, id: null });
  });

  it('fills on „Umstellen“ and closes the question; nothing is sent', () => {
    const one = ROUND_SETTINGS.find((s) => s.kind === 'number' && s.live)!;
    fields[`set_${one.key}`] = field();
    askPreset('universe', 'standard');
    acts().applyPreset!({ place: 'universe', id: 'standard' });
    expect(fields[`set_${one.key}`]!.value).toBe(String(one.def));
    expect(presetAsk).toEqual({ place: null, id: null });
    // No handler of the server is reached: the acts get no context to send with.
    expect(clientFeature.acts.length).toBe(0);
    // An unknown place fills nothing and still closes.
    fields[`set_${one.key}`] = field();
    askPreset('universe', 'standard');
    acts().applyPreset!({ place: 'x', id: 'standard' });
    expect(fields[`set_${one.key}`]!.value).toBe('999');
    expect(presetAsk.place).toBeNull();
  });
});
