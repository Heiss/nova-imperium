// „Optionen“, the box of „Keine Wachen annehmen“ (#440): the option as the
// server keeps it, the box only while „Wache stellen“ is on.
import { describe, expect, it } from 'vitest';
import { holdPart, holdShown } from './holding.ts';
import type { OptionsState } from './state.ts';

const at = (holdOn: number, holdsRefused?: boolean): OptionsState =>
  ({ s: { round: { holdOn }, holdsRefused }, now: 0, ui: {} }) as never;

describe('the box „Keine Wachen annehmen“ (#440)', () => {
  it('shows the option of the server, off without one', () => {
    expect(holdPart(at(1, true))).toEqual({ refused: true, offered: true });
    expect(holdPart(at(1))).toEqual({ refused: false, offered: true });
  });

  it('is hidden while „Wache stellen“ is off (okf/ops/feature-switches.md)', () => {
    expect(holdShown(holdPart(at(1)))).toBe(true);
    expect(holdShown(holdPart(at(0, true)))).toBe(false);
  });
});
