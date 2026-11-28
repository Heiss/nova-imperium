// The chat window (#496, owner, 2026-11-28): at the bottom right of the
// interface Classic, with the tabs „Gilde“ and „Persönlich“; none on a phone.
// Its switch of the round (okf/ops/feature-switches.md), live like
// „Verbandsangriff“: a number of 1 (An) and 0 (Aus), „An“ in a universe
// without the key. Off, the window is gone; the guild chat and the private
// messages stay where they are, under their own rules.
import { LIVE_SWITCH } from './live-switch.ts';
import type { RoundSetting } from './round.ts';

/** The heading of the setting in the admin panel (#357) [V]. */
export const roundHeading = 'Chatfenster';

/** The switch as an entry of the registry of the round settings (#283, #310). */
export const roundSettings = [
  {
    kind: 'number',
    key: 'roundChatWindowOn',
    explain: {
      text: 'Blendet unten rechts ein Chatfenster mit dem Gilden-Chat und den privaten Nachrichten ein, nicht auf dem Telefon. Aus: kein Fenster; Gilden-Chat und Nachrichten bleiben unter „Gilden“ und „Nachrichten“.',
    },
    name: 'chatWindowOn',
    label: 'Chatfenster',
    order: 530,
    ...LIVE_SWITCH,
  },
] as const satisfies readonly RoundSetting[];

/** Whether the round shows the chat window: „An“ by default (#496). */
export const chatWindowOpen = (round: { chatWindowOn?: number }): boolean =>
  round.chatWindowOn !== 0;
