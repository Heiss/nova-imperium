import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD, RES, UNIT } from '../../core/catalog.ts';
import { ICON_KEYS, iconURL, resourceIconURL } from './icons.ts';

const STATIC = path.resolve(import.meta.dirname, '../static');
const onDisk = (url: string): boolean => existsSync(path.join(STATIC, url));

describe('icons', () => {
  it('has one picture for every building, research, ship and defense', () => {
    expect([...ICON_KEYS].sort()).toEqual(
      [...Object.keys(BUILD), ...Object.keys(RES), ...Object.keys(UNIT)].sort(),
    );
  });
  it('points to files that exist', () => {
    for (const k of ICON_KEYS) {
      const url = iconURL(k)!;
      expect(url).toMatch(
        /^\/icons\/(buildings|research|ships|defense)\/\w+\.svg$/,
      );
      expect(onDisk(url), url).toBe(true);
    }
  });
  it('names every picture like its entry for screen readers (#94)', () => {
    const all = { ...BUILD, ...RES, ...UNIT };
    for (const k of ICON_KEYS) {
      const svg = readFileSync(path.join(STATIC, iconURL(k)!), 'utf8');
      const n = all[k]!.n;
      expect(svg, k).toContain(`aria-label="${n}"`);
      expect(svg, k).toContain(`<title>${n}</title>`);
    }
    const names = {
      metal: 'Adamant',
      crystal: 'Psikristall',
      deuterium: 'Promethium',
      energy: 'Energie',
    } as const;
    for (const [k, n] of Object.entries(names))
      for (const small of [true, false]) {
        const url = resourceIconURL(k as keyof typeof names, small);
        const svg = readFileSync(path.join(STATIC, url), 'utf8');
        expect(svg, url).toContain(`<title>${n}</title>`);
      }
  });
  it('shows the Todesstern with the deathstar of the icon set (#60)', () => {
    expect(iconURL('dstar')).toBe('/icons/ships/deathstar.svg');
  });
  it('knows no picture for an unknown key', () => {
    expect(iconURL('nope')).toBeNull();
    expect(iconURL('toString')).toBeNull();
  });
  it('has a small and a large icon for every resource', () => {
    for (const k of ['metal', 'crystal', 'deuterium', 'energy'] as const) {
      expect(resourceIconURL(k)).toBe(`/icons/resources/small/${k}.svg`);
      expect(resourceIconURL(k, false)).toBe(`/icons/resources/${k}.svg`);
      expect(onDisk(resourceIconURL(k))).toBe(true);
      expect(onDisk(resourceIconURL(k, false))).toBe(true);
    }
  });
});
