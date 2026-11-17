// What the dialog „Neue Runde“ sends (#191, #221, #229).
import { describe, expect, it } from 'vitest';
import { roundChoices } from './new-round.ts';

describe('the choices of the dialog „Neue Runde“', () => {
  it('read the boxes, the lock and the activity thresholds', () => {
    const fields: Record<string, string> = {
      '#round-main-lock': '12',
      '#round-activity-recent': '15',
      '#round-activity-minutes': '59',
      '#round-activity-inactive': '7',
      '#round-activity-longInactive': '',
    };
    const boxes: Record<string, boolean> = {
      '#round-achievements': true,
      '#round-daily': false,
      '#round-guilds': true,
    };
    expect(
      roundChoices(
        (sel) => fields[sel] ?? '',
        (sel) => boxes[sel] ?? false,
      ),
    ).toEqual({
      rewards: { achievements: true, daily: false },
      guilds: true,
      mainLock: 12,
      activity: { recent: 15, minutes: 59, inactive: 7, longInactive: null },
    });
    expect(
      roundChoices(
        () => '',
        () => false,
      ),
    ).toMatchObject({
      rewards: { achievements: false, daily: false },
      guilds: false,
      mainLock: 0,
    });
  });
});
