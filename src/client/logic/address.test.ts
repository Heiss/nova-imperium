import { describe, expect, it } from 'vitest';
import {
  articleHref,
  articleParam,
  LEXICANUM_VIEW,
  stateUrl,
  viewUrl,
} from './address.ts';

const HREF = 'https://nova.example/?view=guilds&guild=g1&a=spy#invite=x';
/** The address parameters of today's views (#379: declared by guilds.ts and lexicanum.ts). */
const TABLE = { guilds: ['guild'], lexicanum: ['a'] };

describe('the address of a view (#163, #285)', () => {
  it('keeps the guild only for the guild view and drops the hash', () => {
    expect(viewUrl(HREF, 'guilds', { guild: 'g2' }, TABLE)).toBe(
      '/?view=guilds&guild=g2',
    );
    expect(viewUrl(HREF, 'guilds', {}, TABLE)).toBe('/?view=guilds');
    expect(viewUrl(HREF, 'buildings', { guild: 'g2' }, TABLE)).toBe(
      '/?view=buildings',
    );
  });

  it('holds the article only for the Lexicanum', () => {
    expect(LEXICANUM_VIEW).toBe('lexicanum');
    expect(viewUrl(HREF, 'lexicanum', { a: 'probe' }, TABLE)).toBe(
      '/?view=lexicanum&a=probe',
    );
    expect(viewUrl(HREF, 'lexicanum', {}, TABLE)).toBe('/?view=lexicanum');
    expect(viewUrl(HREF, 'research', { a: 'probe' }, TABLE)).toBe(
      '/?view=research',
    );
    expect(
      viewUrl(
        'https://n.example/x?view=help',
        'lexicanum',
        { a: 'a b' },
        TABLE,
      ),
    ).toBe('/x?view=lexicanum&a=a+b');
  });

  it('links an article relatively, with the view and the article', () => {
    expect(articleHref('spy')).toBe('?view=lexicanum&a=spy');
    expect(articleHref('a b&c')).toBe('?view=lexicanum&a=a%20b%26c');
    expect(articleHref('')).toBe('?view=lexicanum');
  });

  it('reads the article of an address', () => {
    expect(articleParam('?view=lexicanum&a=spy')).toBe('spy');
    expect(articleParam('?view=lexicanum')).toBe('');
    expect(articleParam('')).toBe('');
  });
});

describe('the address of the state', () => {
  it('names the planet, and none for the main planet', () => {
    expect(stateUrl()).toBe('/api/state');
    expect(stateUrl('')).toBe('/api/state');
    expect(stateUrl('p 1&x')).toBe('/api/state?planet=p%201%26x');
  });

  it('names the open conversation of the private messages when there is one (Q32)', () => {
    expect(stateUrl(undefined, { pm: 'Bert', pmAfter: 12 })).toBe(
      '/api/state?pm=Bert&pmAfter=12',
    );
    expect(stateUrl('p1', { pm: 'Ärger & Co', pmAfter: 0 })).toBe(
      '/api/state?planet=p1&pm=%C3%84rger%20%26%20Co&pmAfter=0',
    );
    // The deleted accounts: the empty name.
    expect(stateUrl(undefined, { pm: '', pmAfter: 3 })).toBe(
      '/api/state?pm=&pmAfter=3',
    );
    // Half of it names nothing.
    expect(stateUrl(undefined, { pm: 'Bert' })).toBe('/api/state');
    expect(stateUrl(undefined, {})).toBe('/api/state');
  });

  it('names no conversation for a newest message without a name', () => {
    expect(stateUrl(undefined, { pmAfter: 5 })).toBe('/api/state');
    expect(stateUrl('p1', { pmAfter: 0 })).toBe('/api/state?planet=p1');
  });
});
