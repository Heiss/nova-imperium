// A guard of the generated lists (#426): each key of a kind is declared by
// one file only. A key declared twice stops the start with both files named,
// so no entry silently replaces another.

/**
 * A check for the entries of <what> (for example „Push kind“): the call
 * `once(field, key, file)` throws when another file already declared that
 * key of that field.
 */
export function ownedOnce(
  what: string,
): (field: string, key: string, file: string) => void {
  const owner = new Map<string, string>();
  return (field, key, file) => {
    const first = owner.get(`${field} ${key}`);
    if (first !== undefined)
      throw new Error(
        `${what} ${field} ${key} is defined twice: in ${first} and in ${file}.`,
      );
    owner.set(`${field} ${key}`, file);
  };
}
