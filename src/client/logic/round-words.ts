// The words the archive and the Rewind share (#235): a date, a number of days
// and the line about a round whose early history is missing. Drafts of Claude [V].

/** A date as the archive shows it. */
export const day = (t: number): string =>
  new Date(t).toLocaleDateString('de-DE');

export const daysText = (n: number): string =>
  `${n} ${n === 1 ? 'Tag' : 'Tage'}`;

export const COVERAGE = {
  complete: 'vollständig ab Rundenbeginn',
  partial:
    'Die Runde lief schon, als das Archiv eingeführt wurde: ihr früher Verlauf fehlt.',
} as const;
