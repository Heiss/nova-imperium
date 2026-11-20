// mutation-floors.txt: one line per file, sorted (#317 part 4).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLOORS_FILE,
  formatFloors,
  isCanonical,
  parseFloors,
} from '../../scripts/mutation-floorfile.ts';
import { parseStandard, STANDARD } from '../../scripts/mutation-gate.ts';

describe('the floors file', () => {
  it('has one line per file: the path, a space and the floor', () => {
    expect(parseFloors('src/a.ts 70\nsrc/b.ts 93.44\nsrc/c.ts 100\n')).toEqual({
      'src/a.ts': 70,
      'src/b.ts': 93.44,
      'src/c.ts': 100,
    });
    expect(parseFloors('')).toEqual({});
    expect(parseFloors('src/a.ts 0\n')).toEqual({ 'src/a.ts': 0 });
    // A missing newline at the end reads the same; isCanonical tells it.
    expect(parseFloors('src/a.ts 70')).toEqual({ 'src/a.ts': 70 });
  });

  it('writes the lines sorted by path, each floor as a number', () => {
    expect(
      formatFloors({ 'src/b.ts': 93.4, 'src/a.ts': 70, 'a.ts': 100 }),
    ).toBe('a.ts 100\nsrc/a.ts 70\nsrc/b.ts 93.4\n');
    expect(formatFloors({})).toBe('');
  });

  it('writes what it reads', () => {
    const text = 'a.ts 100\nsrc/a.ts 70\nsrc/b.ts 93.44\n';
    expect(formatFloors(parseFloors(text))).toBe(text);
    expect(isCanonical(text)).toBe(true);
    expect(isCanonical('')).toBe(true);
  });

  it('is canonical only when sorted, with a newline at the end and short floors', () => {
    expect(isCanonical('src/b.ts 70\nsrc/a.ts 70\n')).toBe(false);
    expect(isCanonical('src/a.ts 70')).toBe(false);
    expect(isCanonical('src/a.ts 70.50\n')).toBe(false);
    // A text that is no floors is no canonical text, and it is no answer either.
    expect(() => isCanonical('\n')).toThrow('line 1');
  });

  it('refuses a file with two lines, naming the file and both floors', () => {
    // What a merge by union leaves when both branches changed one file.
    expect(() => parseFloors('src/a.ts 70\nsrc/a.ts 75\n')).toThrow(
      "mutation-floors.txt, line 2: src/a.ts has two floors (70 and 75), probably a merge of two branches that changed it. Keep the line of main or the higher one (never a lower floor than main's) and delete the other.",
    );
    expect(() => parseFloors('src/a.ts 70\nsrc/b.ts 1\nsrc/a.ts 70\n')).toThrow(
      'line 3: src/a.ts has two floors (70 and 70)',
    );
  });

  it('refuses a line that is no floor, naming the line', () => {
    for (const [line, text] of [
      [1, 'src/a.ts\n'],
      [1, 'src/a.ts  70\n'],
      [2, 'src/a.ts 70\nsrc/b.ts 70 \n'],
      [1, 'src/a.ts seventy\n'],
      [1, 'src/a.ts 70.123\n'],
      [1, 'src/a.ts -1\n'],
      [1, 'src/a.ts 1e2\n'],
      [1, '{"src/a.ts": 70}\n'],
      [2, 'src/a.ts 70\n\n'],
      [1, ' src/a.ts 70\n'],
      [1, '<<<<<<< HEAD\n'],
    ] as const)
      expect(() => parseFloors(text)).toThrow(
        `mutation-floors.txt, line ${line}: `,
      );
    expect(() => parseFloors('src/a.ts 101\n')).toThrow(
      'line 1: src/a.ts has a floor above 100.',
    );
    expect(parseFloors('src/a.ts 100\n')).toEqual({ 'src/a.ts': 100 });
  });

  it('is the real file: every floor valid, once, in order, and the standard reads it', () => {
    const text = readFileSync(FLOORS_FILE, 'utf8');
    expect(isCanonical(text)).toBe(true);
    const standard = parseStandard(readFileSync(STANDARD, 'utf8'), text);
    expect(Object.keys(standard.floors).length).toBeGreaterThan(100);
    expect(standard.newFile).toBeGreaterThan(0);
  });
});
