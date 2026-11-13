// Writes the tileable planet textures of src/client/static/planets/: per type
// and variant a surface and a cloud layer, drawn with feTurbulence and
// stitchTiles so a shift by one tile loops without a seam (issue #61, D7/D8).
// Run: node scripts/planet-textures.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PLANET_TYPE_NAMES, PLANET_VARIANTS } from '../src/core/planet-type.ts';
import type { PlanetType } from '../src/core/planet-type.ts';

const W = 512;
const H = 256;
const OUT = path.resolve(import.meta.dirname, '../src/client/static/planets');

type Stop = [number, string];
interface Noise {
  freq: string;
  octaves: number;
  seed: number;
}
interface Look {
  surface: Noise & { stops: Stop[]; extra?: string };
  clouds: Noise & { gain: number; bias: number; color?: string };
}

const rgb = (hex: string): number[] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** The colour at x (0..1) of a gradient given by stops. */
function colourAt(stops: Stop[], x: number): number[] {
  const i = stops.findIndex(([pos], j) => j > 0 && x <= pos);
  if (i < 1) return rgb(stops[x < stops[0]![0] ? 0 : stops.length - 1]![1]);
  const [p0, c0] = stops[i - 1]!;
  const [p1, c1] = stops[i]!;
  const t = p1 === p0 ? 0 : (x - p0) / (p1 - p0);
  const a = rgb(c0);
  const b = rgb(c1);
  return a.map((v, k) => v + (b[k]! - v) * t);
}

/** feComponentTransfer tables that map grey noise to the gradient. */
function tables(stops: Stop[], n = 48): string[] {
  const rows = Array.from({ length: n }, (_, i) =>
    colourAt(stops, i / (n - 1)),
  );
  return [0, 1, 2].map((k) => rows.map((c) => c[k]!.toFixed(3)).join(' '));
}

const turbulence = (n: Noise): string =>
  `<feTurbulence type="fractalNoise" baseFrequency="${n.freq}" numOctaves="${n.octaves}" seed="${n.seed}" stitchTiles="stitch"/>`;

const svg = (title: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none"><title>${title}</title>${body}</svg>\n`;

function surface(title: string, s: Look['surface']): string {
  const [r, g, b] = tables(s.stops);
  return svg(
    title,
    `<filter id="t" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${turbulence(s)}<feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"/><feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer></filter><rect width="${W}" height="${H}" filter="url(#t)"/>${s.extra ?? ''}`,
  );
}

function clouds(title: string, c: Look['clouds']): string {
  const [r, g, b] = rgb(c.color ?? '#ffffff').map((v) => v.toFixed(3));
  return svg(
    title,
    `<filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${turbulence(c)}<feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${c.gain} 0 0 0 ${c.bias}"/></filter><rect width="${W}" height="${H}" filter="url(#c)"/>`,
  );
}

const storm = (cx: number, cy: number): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="46" ry="19" fill="#a8452a" opacity=".8"/><ellipse cx="${cx}" cy="${cy}" rx="30" ry="12" fill="#d07048" opacity=".9"/><ellipse cx="${cx - 4}" cy="${cy - 2}" rx="14" ry="5" fill="#eaa070" opacity=".8"/>`;

/** The look of each type; the seeds are the base of variant 0. */
const LOOKS: Record<PlanetType, Look> = {
  normal: {
    surface: {
      freq: '0.009 0.014',
      octaves: 5,
      seed: 3,
      stops: [
        [0, '#071c3c'],
        [0.46, '#12407a'],
        [0.54, '#2f78b4'],
        [0.56, '#d2bd86'],
        [0.58, '#5f8a3a'],
        [0.64, '#3b6a2a'],
        [0.72, '#7a6c58'],
        [0.8, '#e9eef2'],
        [1, '#ffffff'],
      ],
    },
    clouds: {
      freq: '0.012 0.028',
      octaves: 5,
      seed: 21,
      gain: 4.2,
      bias: -2.35,
    },
  },
  wasser: {
    surface: {
      freq: '0.008 0.012',
      octaves: 5,
      seed: 7,
      stops: [
        [0, '#041431'],
        [0.45, '#0b3570'],
        [0.58, '#1d68a8'],
        [0.64, '#4fb4d4'],
        [0.66, '#d9c690'],
        [0.7, '#4f8a3a'],
        [1, '#2f5a22'],
      ],
    },
    clouds: { freq: '0.01 0.03', octaves: 5, seed: 33, gain: 4.8, bias: -2.6 },
  },
  dschungel: {
    surface: {
      freq: '0.014 0.02',
      octaves: 5,
      seed: 11,
      stops: [
        [0, '#0f3d4a'],
        [0.36, '#1b5566'],
        [0.4, '#123d18'],
        [0.5, '#1f5a22'],
        [0.6, '#2f7a2c'],
        [0.7, '#5c9234'],
        [1, '#a8b85a'],
      ],
    },
    clouds: {
      freq: '0.014 0.03',
      octaves: 5,
      seed: 44,
      gain: 3.6,
      bias: -1.85,
      color: '#eef6f0',
    },
  },
  trocken: {
    surface: {
      freq: '0.011 0.018',
      octaves: 5,
      seed: 5,
      stops: [
        [0, '#3a2a1c'],
        [0.4, '#5c4430'],
        [0.48, '#8a6a45'],
        [0.6, '#b89a6a'],
        [0.7, '#d8c49a'],
        [0.74, '#efe6d0'],
        [1, '#f8f4ea'],
      ],
    },
    clouds: { freq: '0.012 0.03', octaves: 4, seed: 55, gain: 4.5, bias: -2.9 },
  },
  wueste: {
    surface: {
      freq: '0.013 0.024',
      octaves: 5,
      seed: 9,
      stops: [
        [0, '#4a1c0c'],
        [0.4, '#6e3214'],
        [0.44, '#a4561f'],
        [0.52, '#d08a3e'],
        [0.6, '#e6b46a'],
        [0.7, '#f3d9a0'],
        [1, '#fff0c8'],
      ],
    },
    clouds: {
      freq: '0.006 0.03',
      octaves: 3,
      seed: 66,
      gain: 3.0,
      bias: -1.7,
      color: '#f0b070',
    },
  },
  eis: {
    surface: {
      freq: '0.016 0.02',
      octaves: 5,
      seed: 13,
      stops: [
        [0, '#3c6a92'],
        [0.36, '#6f9cc4'],
        [0.42, '#a9c8e2'],
        [0.52, '#d6e6f3'],
        [0.62, '#eef5fb'],
        [1, '#ffffff'],
      ],
    },
    clouds: {
      freq: '0.012 0.035',
      octaves: 4,
      seed: 77,
      gain: 3.2,
      bias: -1.95,
      color: '#f4fbff',
    },
  },
  gas: {
    surface: {
      freq: '0.0035 0.07',
      octaves: 3,
      seed: 17,
      stops: [
        [0, '#5a3a22'],
        [0.3, '#8a5a36'],
        [0.42, '#c48a52'],
        [0.5, '#e3bd86'],
        [0.58, '#f2e0bc'],
        [0.7, '#b07648'],
        [1, '#6b4a2e'],
      ],
    },
    clouds: {
      freq: '0.003 0.11',
      octaves: 3,
      seed: 88,
      gain: 3.2,
      bias: -1.7,
      color: '#f6e6c8',
    },
  },
};

function write(type: PlanetType, v: number): void {
  const look = LOOKS[type];
  const name = PLANET_TYPE_NAMES[type];
  const shift = v * 101;
  const extra = type === 'gas' ? storm(150 + v * 110, 168 - v * 40) : '';
  const s = { ...look.surface, seed: look.surface.seed + shift, extra };
  const c = { ...look.clouds, seed: look.clouds.seed + shift };
  writeFileSync(
    path.join(OUT, `${type}-${v}-surface.svg`),
    surface(`${name} – Oberfläche`, s),
  );
  writeFileSync(
    path.join(OUT, `${type}-${v}-clouds.svg`),
    clouds(`${name} – Wolken`, c),
  );
}

mkdirSync(OUT, { recursive: true });
for (const type of Object.keys(LOOKS) as PlanetType[])
  for (let v = 0; v < PLANET_VARIANTS; v++) write(type, v);
