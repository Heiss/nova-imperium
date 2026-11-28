// The events of the membership in the guild chat (#169 D3, D4; owner,
// 2026-11-14 and 2026-11-15): a member joined, left or was removed. `order`
// is the place of a kind; `sentence` its line in the chat, plain text that
// the view escapes; `who` is the name of the member, capitalised.
export const chatEvents = [
  {
    key: 'join',
    order: 10,
    sentence: ({ who }: { who: string }) => `${who} ist der Gilde beigetreten.`,
  },
  {
    key: 'leave',
    order: 20,
    sentence: ({ who }: { who: string }) => `${who} hat die Gilde verlassen.`,
  },
  {
    key: 'remove',
    order: 30,
    sentence: ({ who }: { who: string }) =>
      `${who} wurde aus der Gilde entfernt.`,
  },
] as const;
