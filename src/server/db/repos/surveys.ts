// Surveyed free positions (#190, D1): the values a free position gets at its
// first survey, one row per position in the table `surveys`, kept until a
// planet is founded there or for 30 days.
import type { SurveyValues } from '../../../core/survey.ts';
import type { Coords } from '../../../core/types.ts';
import type { Db } from '../database.ts';
import type { Row } from './rows.ts';

/** The stored values of a position, with the id its reports name. */
export interface Survey extends Coords, SurveyValues {
  id: string;
  /** When the position was first surveyed. */
  created: number;
}

export interface Surveys {
  /** The values of a position, or null when it was not surveyed. */
  get(c: Coords): Survey | null;
  add(s: Survey): void;
  /** Deletes the values of a position, once a planet is founded there. */
  delete(c: Coords): void;
  /** Deletes the surveys made before `cutoff` and returns their ids. */
  expire(cutoff: number): string[];
  deleteAll(): void;
}

const surveyOf = (r: Row): Survey => ({
  id: r.id as string,
  g: r.g as number,
  s: r.s as number,
  p: r.p as number,
  temp: r.temp as number,
  diameter: r.diameter as number,
  created: r.created as number,
});

export class SqliteSurveys implements Surveys {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get(c: Coords): Survey | null {
    const r = this.db
      .prepare('SELECT * FROM surveys WHERE g = ? AND s = ? AND p = ?')
      .get(c.g, c.s, c.p) as Row | undefined;
    return r ? surveyOf(r) : null;
  }

  add(x: Survey): void {
    this.db
      .prepare(
        'INSERT INTO surveys (id, g, s, p, temp, diameter, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(x.id, x.g, x.s, x.p, x.temp, x.diameter, x.created);
  }

  delete(c: Coords): void {
    this.db
      .prepare('DELETE FROM surveys WHERE g = ? AND s = ? AND p = ?')
      .run(c.g, c.s, c.p);
  }

  expire(cutoff: number): string[] {
    const rows = this.db
      .prepare('DELETE FROM surveys WHERE created < ? RETURNING id')
      .all(cutoff) as Row[];
    return rows.map((r) => r.id as string).sort();
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM surveys').run();
  }
}
