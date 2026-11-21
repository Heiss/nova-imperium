import { describe, expect, it } from 'vitest';
import {
  PM_HISTORY,
  PM_PAGE,
  type PmLine,
} from '../../core/private-messages.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { stateFor } from './state.ts';

// The size of one poll (`GET /api/state`, the JSON of `stateFor`) for a
// player with 20 conversations of 500 messages of 1,000 characters each
// (Q27, coordinator, 2026-11-21): before the page of 50 the whole history of
// every conversation travelled with each poll. „Before“ is worked out from the
// same state: the part `privateMessages` is replaced by the one the earlier
// build made (every kept message of every conversation, no `more`). The
// numbers are printed with `NOVA_PRINT_SIZES=1`.
const CONVERSATIONS = 20;
const LENGTH = 1000;

describe('the size of one poll with 20 conversations of 500 messages (Q27)', () => {
  it('carries at most a page per conversation, a fraction of the whole history', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna');
    ctx.tx(() => {
      for (let c = 0; c < CONVERSATIONS; c++) {
        addUser(ctx, `Gegner${c}`);
        for (let i = 0; i < PM_HISTORY; i++) {
          const mine = i % 2 === 0;
          const [from, to] = mine
            ? ['u_Anna', `u_Gegner${c}`]
            : [`u_Gegner${c}`, 'u_Anna'];
          ctx.privateMessages.add(
            from,
            to,
            i,
            String(i).padStart(3, '0') + 'x'.repeat(LENGTH - 3),
          );
        }
      }
    });
    const anna = ctx.players.get('u_Anna')!;
    const state = stateFor(ctx, anna) as {
      privateMessages: {
        conversations: { messages: PmLine[]; more: boolean }[];
      };
    };
    const after = JSON.stringify(state).length;
    expect(state.privateMessages.conversations).toHaveLength(CONVERSATIONS);
    for (const c of state.privateMessages.conversations) {
      expect(c.messages).toHaveLength(PM_PAGE);
      expect(c.more).toBe(true);
    }
    // The earlier build: every kept message of every conversation.
    const whole = ctx.privateMessages.visibleTo('u_Anna');
    expect(whole).toHaveLength(CONVERSATIONS * PM_HISTORY);
    const legacy = {
      ...state,
      privateMessages: {
        ...state.privateMessages,
        conversations: state.privateMessages.conversations.map((c, k) => ({
          ...c,
          more: undefined,
          messages: whole
            .filter(
              (m) =>
                m.sender === `u_Gegner${19 - k}` ||
                m.recipient === `u_Gegner${19 - k}`,
            )
            .map((m) => ({
              id: m.id,
              mine: m.sender === 'u_Anna',
              time: m.time,
              text: m.text,
              read: m.read,
            })),
        })),
      },
    };
    const before = JSON.stringify(legacy).length;
    if (process.env.NOVA_PRINT_SIZES)
      process.stdout.write(`poll bytes before=${before} after=${after}\n`);
    expect(before).toBeGreaterThan(CONVERSATIONS * PM_HISTORY * LENGTH);
    expect(after).toBeLessThan(
      CONVERSATIONS * PM_PAGE * (LENGTH + 100) + 100_000,
    );
    expect(after).toBeLessThan(before / 5);
  });
});
