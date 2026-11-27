// The event of a new rank in the guild chat (#169 D3; owner, 2026-11-14):
// `text` is the new rank.
export const chatEvents = [
  {
    key: 'rank',
    order: 40,
    sentence: ({ who, text }: { who: string; text: string }) =>
      `${who} ist jetzt ${text}.`,
  },
] as const;
