import { describe, expect, it } from 'vitest';
import {
  check,
  floorOf,
  score,
  scoresOf,
  type Standard,
  update,
} from '../../scripts/mutation-gate.ts';

const m = (...statuses: string[]) => statuses.map((status) => ({ status }));

const standard: Standard = {
  securityTarget: 90,
  newFile: 80,
  security: ['src/server/auth.ts', 'src/server/new-secret.ts'],
  floors: { 'src/server/auth.ts': 83.75, 'src/shared/a.ts': 70 },
};

describe('mutation gate', () => {
  it('scores like Stryker: killed and timeout count, errors and ignored not', () => {
    expect(score(m('Killed', 'Timeout', 'Survived', 'NoCoverage'))).toBe(50);
    expect(
      score(m('Killed', 'CompileError', 'RuntimeError', 'Ignored', 'Pending')),
    ).toBe(100);
    expect(score(m('Killed', 'Killed', 'Survived'))).toBe(66.66);
    expect(score(m('CompileError'))).toBeNull();
    expect(score([])).toBeNull();
  });

  it('takes the recorded floor, else the target of a new file', () => {
    expect(floorOf('src/server/auth.ts', standard)).toEqual({
      min: 83.75,
      why: 'recorded floor',
    });
    expect(floorOf('src/server/new-secret.ts', standard)).toEqual({
      min: 90,
      why: 'new security file',
    });
    expect(floorOf('src/shared/b.ts', standard)).toEqual({
      min: 80,
      why: 'new file',
    });
  });

  it('fails only files below their floor; equal passes', () => {
    expect(
      check(
        {
          'src/server/auth.ts': 83.75,
          'src/shared/a.ts': 69.99,
          'src/server/new-secret.ts': 89.99,
          'src/shared/b.ts': 80,
        },
        standard,
      ),
    ).toEqual([
      'src/shared/a.ts: 69.99 % < 70 % (recorded floor)',
      'src/server/new-secret.ts: 89.99 % < 90 % (new security file)',
    ]);
  });

  it('raises floors, never lowers them, and drops files that are gone', () => {
    const next = update(
      {
        'src/server/auth.ts': 91,
        'src/shared/a.ts': 60,
        'src/shared/c.ts': 85,
      },
      standard,
    );
    expect(next.floors).toEqual({
      'src/server/auth.ts': 91,
      'src/shared/a.ts': 70,
      'src/shared/c.ts': 85,
    });
    expect(Object.keys(next.floors)).toEqual(
      [...Object.keys(next.floors)].sort(),
    );
    expect(next.security).toEqual(standard.security);
    expect(update({ 'src/server/auth.ts': 80 }, standard).floors).toEqual({
      'src/server/auth.ts': 83.75,
    });
    expect(standard.floors['src/server/auth.ts']).toBe(83.75);
  });

  it('skips files without counted mutants', () => {
    expect(
      scoresOf({
        files: {
          'src/shared/types.ts': { mutants: [] },
          'src/shared/a.ts': { mutants: m('Killed', 'Survived') },
        },
      }),
    ).toEqual({ 'src/shared/a.ts': 50 });
  });
});
