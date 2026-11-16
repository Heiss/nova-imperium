// Migration 7, numbered by its place before the IDs (#213).
// retain announcement text until push delivery
export const id = '20261107T1556-announcement-text';
export const number = 7;
export const sql = `
  ALTER TABLE push_jobs ADD COLUMN body TEXT;
  `;
