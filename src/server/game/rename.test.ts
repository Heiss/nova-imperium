import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { rename } from './actions.ts';

// The action `rename` asks the core check `planetNameError` (#214); its
// refusal and the order of its checks stay as they were.

function setup() {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna');
  addPlanet(ctx, u.id);
  const p = () => ctx.planets.home(u.id)!;
  return { ctx, u, p };
}

describe('rename', () => {
  it('refuses an empty name with the old message', () => {
    const { ctx, u, p } = setup();
    const name = p().name;
    // A request may carry no name or null, whatever the input type says.
    const empties: unknown[] = ['', '   ', '\u0007\u001f', undefined, null];
    for (const empty of empties)
      expect(() => rename(ctx, u, { name: empty as string })).toThrow(
        /^Bitte einen Namen eingeben\.$/,
      );
    expect(p().name).toBe(name);
  });

  it('checks the name before the planet', () => {
    const { ctx, u } = setup();
    expect(() => rename(ctx, u, { name: ' ', planet: 'nowhere' })).toThrow(
      /^Bitte einen Namen eingeben\.$/,
    );
    expect(() => rename(ctx, u, { name: 'Neu', planet: 'nowhere' })).toThrow(
      /^Du hast keinen Zugriff auf diesen Planeten\.$/,
    );
  });

  it('cuts the cleaned name at 20 characters', () => {
    const { ctx, u, p } = setup();
    expect(rename(ctx, u, { name: ` ${'x'.repeat(25)} ` })).toBeNull();
    expect(p().name).toBe('x'.repeat(20));
    rename(ctx, u, { name: '  a\u0007b  ' });
    expect(p().name).toBe('ab');
  });
});
