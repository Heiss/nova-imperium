// The push kinds of the server (#192): a message of the admin and a new
// version.
export const pushTopics = [
  { key: 'announcement', order: 80, label: 'Servernachrichten' },
  { key: 'news', order: 90, label: 'Neue Version' },
] as const;
