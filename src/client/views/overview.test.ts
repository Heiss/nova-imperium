// The overview (#118): the component shows the view state of the state
// module. Rendered on the server side of Svelte, as text.
import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFleet, GameState } from '../logic/types.ts';
import type { Ui, V } from './common.ts';
import Overview from './Overview.svelte';

const view = (name = 'Heimat', fleets: ClientFleet[] = []): V => ({
  s: {
    cfg: U,
    me: { id: 'u1' },
    fleets,
    players: { u1: { name: 'Ich', points: 10 } },
  } as unknown as GameState,
  P: planet({ name }),
  R: { research: {}, rq: null },
  now: 0,
  ui: {} as Ui,
});

function html(v: V | null): string {
  client.shown = v;
  return render(Overview).body;
}

afterEach(() => (client.shown = null));

describe('Overview', () => {
  it('shows nothing before the first render', () => {
    // Svelte's hydration markers are comments; nothing else is rendered.
    expect(html(null)).toMatch(/^(?:<!--[^>]*-->)*$/);
  });

  it('follows the view state of the client', () => {
    expect(html(view('Kolonie'))).toContain(
      '<h2>Übersicht – Kolonie [1:1:5]</h2>',
    );
    expect(html(view('Heimat'))).toContain(
      '<h2>Übersicht – Heimat [1:1:5]</h2>',
    );
  });

  it('escapes what players write', () => {
    const foreign = {
      id: 'f1',
      owner: 'u2',
      fromC: { g: 1, s: 1, p: 1 },
      toC: { g: 1, s: 1, p: 5 },
      to: 'p1_1_5',
      mission: 'attack',
      state: 'out',
      arr: 10,
      ships: {},
    } satisfies ClientFleet;
    const v = view('<img src=x onerror=alert(1)>', [foreign]);
    v.s.players.u2 = { name: '<script>x</script>', points: 0 };
    const out = html(v);
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;img src=x onerror=alert(1)>');
    expect(out).toContain('&lt;script>x&lt;/script>');
  });

  it('offers the recall of an own fleet and the rename of the planet', () => {
    const own = {
      id: 'f7',
      owner: 'u1',
      fromC: { g: 1, s: 1, p: 5 },
      toC: { g: 1, s: 2, p: 3 },
      to: 'p1_2_3',
      mission: 'transport',
      state: 'out',
      arr: 10,
      ships: { sc: 1 },
    } satisfies ClientFleet;
    const out = html(view('Heimat', [own]));
    expect(out).toContain('data-act="recall" data-id="f7"');
    expect(out).toContain('<span class="lnk" data-act="rename">(umbenennen)');
  });
});
