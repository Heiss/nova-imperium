// Migration 10, numbered by its place before the IDs (#213).
// display option of the explanation texts per player (issue #63)
export const id = '20261112T1613-explanation-texts';
export const number = 10;
export const sql = `
  ALTER TABLE users ADD COLUMN explain_mode TEXT NOT NULL DEFAULT 'icon'
    CHECK (explain_mode IN ('always', 'icon', 'hidden'));
  `;
