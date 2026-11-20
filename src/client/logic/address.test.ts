import { describe, expect, it } from 'vitest';
import {
  articleHref,
  articleParam,
  LEXICANUM_VIEW,
  stateUrl,
  viewUrl,
} from './address.ts';

const HREF = 'https://nova.example/?view=guilds&guild=g1&a=spy#invite=x';

describe('the address of a view (#163, #285)', () => {
  it('keeps the guild only for the guild view and drops the hash', () => {
    expect(viewUrl(HREF, 'guilds', 'g2')).toBe('/?view=guilds&guild=g2');
    expect(viewUrl(HREF, 'guilds')).toBe('/?view=guilds');
    expect(viewUrl(HREF, 'buildings', 'g2')).toBe('/?view=buildings');
  });

  it('holds the article only for the Lexicanum', () => {
    expect(LEXICANUM_VIEW).toBe('lexicanum');
    expect(viewUrl(HREF, 'lexicanum', null, 'probe')).toBe(
      '/?view=lexicanum&a=probe',
    );
    expect(viewUrl(HREF, 'lexicanum')).toBe('/?view=lexicanum');
    expect(viewUrl(HREF, 'research', null, 'probe')).toBe('/?view=research');
    expect(
      viewUrl('https://n.example/x?view=help', 'lexicanum', null, 'a b'),
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
});
