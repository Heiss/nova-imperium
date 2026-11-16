// Migration 14, numbered by its place before the IDs (#213).
// diameter and field limit of the planets (issue #51). Planets that
// exist now have no field limit until the next round; the home planet (the
// oldest of its owner) gets 12,800 km, a colony a diameter from the field
// range of its position (16 and above like 15).
export const id = '20261113T1126-planet-fields';
export const number = 14;
export const sql = `
  ALTER TABLE planets ADD COLUMN diameter INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE planets ADD COLUMN unlimited INTEGER NOT NULL DEFAULT 0
    CHECK (unlimited IN (0, 1));

  WITH ranges (pos, lo, hi) AS (VALUES
    (1, 9798, 13152), (2, 10199, 13304), (3, 10584, 13527),
    (4, 10863, 14456), (5, 11533, 15264), (6, 12084, 15588),
    (7, 12329, 15779), (8, 12490, 15905), (9, 12248, 15716),
    (10, 11917, 15264), (11, 11662, 14525), (12, 11181, 13674),
    (13, 10678, 13152), (14, 10000, 12999), (15, 9487, 12845))
  UPDATE planets SET unlimited = 1, diameter = CASE
    WHEN id = (SELECT h.id FROM planets h WHERE h.owner = planets.owner
      ORDER BY h.created, h.id LIMIT 1) THEN 12800
    ELSE (SELECT lo + abs(random() % (hi - lo + 1)) FROM ranges
      WHERE pos = min(max(planets.p, 1), 15))
  END;
  `;
