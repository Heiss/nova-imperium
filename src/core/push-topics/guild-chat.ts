// The push kinds of the guild chat (#169): hidden in the options while guilds
// are off in the round (owner, 2026-11-15), so they are marked `guild`.
export const pushTopics = [
  { key: 'guild-events', order: 100, label: 'Gildenereignisse', guild: true },
  {
    key: 'guild-chat',
    order: 110,
    label: 'Nachrichten im Gilden-Chat',
    guild: true,
  },
] as const;
