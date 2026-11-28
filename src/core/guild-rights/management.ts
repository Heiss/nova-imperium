// The rights of the guild management a rank can be given (#163, owner,
// 2026-11-13). Dissolving the guild, handing over the Leitung and choosing the
// default rank are no rights: only the Leitung does them. `order` is the
// place of a right in the guild view; `label` its name there and in the
// Lexicanum (#163, #288).
export const guildRights = [
  {
    key: 'applications',
    order: 10,
    label: 'Bewerbungen annehmen und ablehnen',
  },
  { key: 'remove', order: 20, label: 'Mitglieder entfernen' },
  { key: 'assign', order: 30, label: 'Ränge an Mitglieder vergeben' },
  { key: 'profile', order: 40, label: 'Gildenname, Kürzel und Text ändern' },
  { key: 'ranks', order: 50, label: 'Ränge verwalten' },
] as const;
