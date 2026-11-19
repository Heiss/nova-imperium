// The rules that hold for every client feature (#322). The test names no
// feature and no count: a feature adds its handlers in its own file
// (`clientFeature`), and each feature tests its own handlers in its own test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assembleActs, assembleForms } from './assemble.ts';
import type { ClientFeature } from './contract.ts';
import { CLIENT_FEATURES } from './index.gen.ts';
import { fakeCtx } from './test-ctx.ts';

const features: readonly (readonly [string, ClientFeature])[] = CLIENT_FEATURES;

// A feature may listen to the document for its forms when it is built.
beforeEach(() => {
  vi.stubGlobal('document', { addEventListener: vi.fn() });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the list of the client features', () => {
  it('names each module once, by its file', () => {
    const names = features.map(([name]) => name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-zA-Z0-9/-]*$/);
  });

  it('gives every module acts that return functions under plain names', () => {
    for (const [name, feature] of features) {
      expect(typeof feature.acts, name).toBe('function');
      const acts = feature.acts(fakeCtx());
      expect(Object.keys(acts).length, name).toBeGreaterThan(0);
      for (const [act, handler] of Object.entries(acts)) {
        expect(act, `${name}: ${act}`).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
        expect(typeof handler, `${name}: ${act}`).toBe('function');
      }
    }
  });

  it('gives every form handler a plain id and a function', () => {
    for (const [name, feature] of features)
      for (const [id, handler] of Object.entries(
        feature.forms?.(fakeCtx()) ?? {},
      )) {
        expect(id, `${name}: ${id}`).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(typeof handler, `${name}: ${id}`).toBe('function');
      }
  });

  it('defines no data-act name and no form id twice', () => {
    expect(() => assembleActs({}, features, fakeCtx())).not.toThrow();
    expect(() => assembleForms({}, features, fakeCtx())).not.toThrow();
  });
});

describe('the table of the handlers', () => {
  const a = vi.fn();
  const b = vi.fn();
  const module = (acts: Record<string, () => unknown>): ClientFeature => ({
    acts: () => acts,
  });

  it('holds the frame handlers and those of every module', () => {
    const table = assembleActs(
      { start: a },
      [
        ['one', module({ build: b })],
        ['two', module({ cancel: b, research: b })],
      ],
      fakeCtx(),
    );
    expect(Object.keys(table).sort()).toEqual([
      'build',
      'cancel',
      'research',
      'start',
    ]);
    expect(table.start).toBe(a);
    expect(table.cancel).toBe(b);
  });

  it('builds each module with the context it was given', () => {
    const ctx = fakeCtx();
    const seen = vi.fn();
    assembleActs({}, [['one', { acts: (c) => (seen(c), { build: b }) }]], ctx);
    expect(seen).toHaveBeenCalledExactlyOnceWith(ctx);
  });

  it('throws when two modules define one name, naming both', () => {
    expect(() =>
      assembleActs(
        {},
        [
          ['one', module({ build: a })],
          ['two', module({ build: b })],
        ],
        fakeCtx(),
      ),
    ).toThrow(
      'data-act "build" is defined in features/one.ts and in features/two.ts.',
    );
  });

  it('merges the form handlers the same way, and a module may have none', () => {
    const form = vi.fn();
    const table = assembleForms(
      { authform: a },
      [
        ['one', { acts: () => ({}), forms: () => ({ guildform: form }) }],
        ['two', module({ build: b })],
      ],
      fakeCtx(),
    );
    expect(table).toEqual({ authform: a, guildform: form });
    expect(() =>
      assembleForms(
        { guildform: a },
        [['one', { acts: () => ({}), forms: () => ({ guildform: form }) }]],
        fakeCtx(),
      ),
    ).toThrow('form "guildform" is defined in main.ts and in features/one.ts.');
  });

  it('throws when a module redefines a frame handler, naming both', () => {
    expect(() =>
      assembleActs({ build: a }, [['one', module({ build: b })]], fakeCtx()),
    ).toThrow('data-act "build" is defined in main.ts and in features/one.ts.');
  });
});
