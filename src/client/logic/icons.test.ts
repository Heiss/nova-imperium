import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD, RES, UNIT } from '../../shared/catalog.ts';
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
