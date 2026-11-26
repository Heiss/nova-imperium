import { afterEach, describe, expect, it } from 'vitest';
import { stateUrl } from './address.ts';
import { shownQuery } from './galaxy-shown.ts';
import { client } from './state.svelte.ts';

afterEach(() => {
  client.game = null;
  client.ui.view = 'overview';
});

describe('the shown system in the requests (151a)', () => {
  it('names the system only while the Sternenkarte is shown', () => {
    expect(shownQuery()).toEqual({});
    client.game = { me: { id: 'u1' } } as never;
    client.ui.view = 'overview';
    expect(shownQuery()).toEqual({});
    client.ui.view = 'galaxy';
    client.ui.gal = 2;
    client.ui.sys = 17;
    expect(shownQuery()).toEqual({ galaxy: '2:17' });
  });

  it('puts it into the address of the state', () => {
    expect(stateUrl(undefined, { galaxy: '2:17' })).toBe(
      '/api/state?galaxy=2%3A17',
    );
    expect(stateUrl('p1', { pm: 'Bert', pmAfter: 3, galaxy: '1:2' })).toBe(
      '/api/state?planet=p1&pm=Bert&pmAfter=3&galaxy=1%3A2',
    );
    expect(stateUrl('p1', { galaxy: '' })).toBe('/api/state?planet=p1');
  });
});
