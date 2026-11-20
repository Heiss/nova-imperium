// The targets of the series of achievements on „Tagesbelohnung und Erfolge“
// (#288) are listed in ascending order whatever the order of the list of
// achievements: the list is shuffled for this test, in a fixed way.
import { expect, it, vi } from 'vitest';

vi.mock('../achievements.ts', async (original) => {
  const real = await original<typeof import('../achievements.ts')>();
  const shuffled = [...real.ACHIEVEMENTS].sort(
    (a, b) =>
      ((a.target * 7) % 13) - ((b.target * 7) % 13) || a.target - b.target,
  );
  return { ...real, ACHIEVEMENTS: shuffled };
});

const { PAGES } = await import('./pages/index.ts');
const { defaultState } = await import('./state.ts');

it('lists the targets of each series in ascending order', () => {
  const page = PAGES.find((p) => p.id === 'rule-rewards')!;
  const table = page
    .sections(defaultState())
    .flatMap((x) => x.blocks)
    .find(
      (b) =>
        b.t === 'table' &&
        b.caption === 'Die Reihen der Erfolge und ihre Zielmarken',
    );
  if (table?.t !== 'table') throw new Error('no table');
  expect(table.rows.map((r) => r.cells[1])).toEqual([
    '1, 2, 3, 5, 8, 10, 12, 15, 20',
    '1, 2, 3, 5, 8, 10, 12, 15, 20',
    '1, 5, 10, 25, 50, 100, 250, 500',
    '1, 5, 10, 25, 50, 100, 250, 500',
    '1, 3, 5, 10, 25, 50, 100, 250',
    '1, 3, 5, 10, 25, 50, 100, 250',
  ]);
});
