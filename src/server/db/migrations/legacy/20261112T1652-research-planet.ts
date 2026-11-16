// Migration 11, numbered by its place before the IDs (#213).
// the planet where the running research started (issue #49)
export const id = '20261112T1652-research-planet';
export const number = 11;
export const sql = `
  ALTER TABLE users ADD COLUMN rq_planet TEXT;
  `;
