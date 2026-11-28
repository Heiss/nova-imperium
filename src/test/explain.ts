// The registry entries and universe specs without their explanation (#358):
// the tests that pin an entry field by field compare the rest of it, while
// src/core/admin-explain.test.ts checks every explanation on its own.

/** `x` with the field `explain` left out of every object in it, one level deep in an array. */
export function withoutExplain<T>(x: T): T {
  const strip = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    return Object.fromEntries(
      Object.entries(v).filter(([key]) => key !== 'explain'),
    );
  };
  return (Array.isArray(x) ? x.map(strip) : strip(x)) as T;
}

/**
 * The „?“ of a setting in the admin panel (#358), as the views render it: `u`
 * after the label in the tab „Universum“, `r` at the end of a field of the
 * dialog „Neue Runde“.
 */
export const explainButton = (key: string, place: 'u' | 'r'): string =>
  `<button type="button" class="exq" id="axq${place}_${key}" data-act="adminExplain" data-k="${key}" data-o="axq${place}_${key}" aria-controls="admin-explain-panel" aria-expanded="false" aria-label="Erklärung">?</button>`;
