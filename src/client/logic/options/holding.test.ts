// „Optionen“, the box of „Keine Wachen annehmen“ (#440): the option as the
// server keeps it, the box only while „Wache stellen“ is on.
import { describe, expect, it } from 'vitest';
import { type HoldChoice, holdPart, holdSaver, holdShown } from './holding.ts';
import type { OptionsState } from './state.ts';

const at = (
  holdOn?: number,
  holdsRefused?: boolean,
  ui: HoldChoice = {},
): OptionsState =>
  ({ s: { round: { holdOn }, holdsRefused }, now: 0, ui }) as never;

describe('the box „Keine Wachen annehmen“ (#440)', () => {
  it('shows the option of the server, off without one', () => {
    expect(holdPart(at(1, true))).toEqual({ refused: true, offered: true });
    expect(holdPart(at(1))).toEqual({ refused: false, offered: true });
  });

  it('is hidden while „Wache stellen“ is off (okf/ops/feature-switches.md)', () => {
    expect(holdShown(holdPart(at(1)))).toBe(true);
    expect(holdShown(holdPart(at(0, true)))).toBe(false);
    // A round without the value reads „An“ (261a).
    expect(holdShown(holdPart(at(undefined)))).toBe(true);
  });
});

describe('the pending choice of „Keine Wachen annehmen“ (CodeRabbit on #455)', () => {
  it('shows the choice of the player while its save runs, then the server', () => {
    expect(holdPart(at(1, true, { holdChoice: false })).refused).toBe(false);
    expect(holdPart(at(1, false, { holdChoice: true })).refused).toBe(true);
    expect(holdPart(at(1, true, {})).refused).toBe(true);
  });

  it('keeps the newest click shown until the last save returns', async () => {
    const choice: HoldChoice = {};
    const answers: (() => void)[] = [];
    const sent: boolean[] = [];
    const change = holdSaver(choice, (on) => {
      sent.push(on);
      return new Promise<void>((r) => answers.push(r));
    });
    const first = change(true);
    expect(choice.holdChoice).toBe(true);
    const last = change(false);
    expect(choice.holdChoice).toBe(false);
    // The first answer comes: the newest click stays shown, not the older one.
    answers.shift()!();
    await new Promise((r) => setTimeout(r, 0));
    expect(choice.holdChoice).toBe(false);
    expect(sent).toEqual([true, false]);
    answers.shift()!();
    await Promise.all([first, last]);
    // Saved: the page shows the server's option again.
    expect(choice.holdChoice).toBeUndefined();
  });

  it('shows the server again after a save that threw', async () => {
    const choice: HoldChoice = {};
    const change = holdSaver(choice, () => Promise.reject(new Error('down')));
    await expect(change(true)).rejects.toThrow('down');
    expect(choice.holdChoice).toBeUndefined();
  });
});
