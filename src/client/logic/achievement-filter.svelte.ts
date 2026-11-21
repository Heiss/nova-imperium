// What the player typed or chose in the filter above the achievements (#332):
// the state of the form. The component Achievements binds it, so a redraw
// that mounts the page anew shows it again; a fresh render drops it
// (form-state.svelte.ts).
import { formState } from './form-state.svelte.ts';

/** The fields of the filter: the search text, the category and the status ('' is „Alle“). */
export interface AchievementFilter {
  search: string;
  category: string;
  status: string;
}

export const achievementFilter = formState((): AchievementFilter => ({
  search: '',
  category: '',
  status: '',
}));

/** What the filter needs to know of an entry of the list. */
export interface Entry {
  category?: string;
  status?: string;
  search: string;
}

/** Whether the filter hides the entry: another category or status, or no match for the text (trimmed, lower case). */
export function hides(filter: AchievementFilter, entry: Entry): boolean {
  const query = filter.search.trim().toLocaleLowerCase('de');
  return (
    (!!filter.category && entry.category !== filter.category) ||
    (!!filter.status && entry.status !== filter.status) ||
    !entry.search.includes(query)
  );
}

/** Whether a group is hidden: it has entries and none is left. */
export const groupHides = (has: boolean, shown: boolean): boolean =>
  has && !shown;
