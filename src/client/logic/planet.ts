// The picture of a planet: type and variant from the coordinates, the texture
// files written by scripts/planet-textures.ts (issue #61, D7/D8).
import {
  PLANET_TYPE_NAMES,
  type PlanetType,
  planetType,
  planetVariant,
} from '../../core/planet-type.ts';
import type { Coords } from '../../core/types.ts';

export interface PlanetLook {
  type: PlanetType;
  variant: number;
  name: string;
  surface: string;
  clouds: string;
}

export function planetLook(c: Coords): PlanetLook {
  const type = planetType(c);
  const variant = planetVariant(c);
  const base = `/planets/${type}-${variant}`;
  return {
    type,
    variant,
    name: PLANET_TYPE_NAMES[type],
    surface: `${base}-surface.svg`,
    clouds: `${base}-clouds.svg`,
  };
}

/** Animations are on unless this viewer turned them off (D9). */
export const ANIMATION_KEY = 'nova.animations';

export function animationsOn(read: () => string | null): boolean {
  try {
    return read() !== 'off';
  } catch {
    return true;
  }
}
