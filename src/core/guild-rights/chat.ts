// The rights of the guild chat (#169, owner, 2026-11-14, D2): „Chat lesen“,
// „Chat schreiben“ and „Chatnachrichten löschen“. `member` marks the rights of
// the first default rank „Mitglied“ of a new guild: reading and writing.
export const guildRights = [
  { key: 'chat-read', order: 60, label: 'Chat lesen', member: true },
  { key: 'chat-write', order: 70, label: 'Chat schreiben', member: true },
  { key: 'chat-delete', order: 80, label: 'Chatnachrichten löschen' },
] as const;
