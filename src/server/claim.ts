// One owner per name: the assemblies of the registered lists (server features,
// repositories, round resets; #317) record which file defines a name and stop
// the start with both files named when a second one does.

/** Records that `file` defines `name`, or throws when another file did. */
export function claim(
  kind: string,
  owners: Map<string, string>,
  name: string,
  file: string,
): void {
  const first = owners.get(name);
  if (first !== undefined)
    throw new Error(`${kind} "${name}" is defined in ${first} and in ${file}.`);
  owners.set(name, file);
}
