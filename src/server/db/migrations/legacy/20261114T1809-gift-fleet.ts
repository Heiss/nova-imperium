// Migration 18, numbered by its place before the IDs (#213).
// the gift fleet of the admin's „Endzeit“ (issue #161). A gift is a
// Verlegung that cannot be recalled, takes no fleet slot and raises the
// research and buildings when it arrives; fleets in flight are no gift.
export const id = '20261114T1809-gift-fleet';
export const number = 18;
export const sql = `
  ALTER TABLE fleets ADD COLUMN gift INTEGER NOT NULL DEFAULT 0
    CHECK (gift IN (0, 1));
  `;
