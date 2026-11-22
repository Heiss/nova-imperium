// Shows the values the server will refuse in the groups of the admin panel
// (#357): their groups unfold, their fields are marked, and the first one
// takes the focus once the page shows it. Used by features/admin.ts (the tab
// „Universum“) and features/round.ts (the dialog „Neue Runde“).
import { flushSync } from 'svelte';
import {
  type GroupPlace,
  showInvalid,
  type Wrong,
} from '../logic/admin-groups.svelte.ts';

export function showWrong(place: GroupPlace, wrong: readonly Wrong[]): void {
  showInvalid(place, wrong);
  if (!wrong.length) return;
  flushSync();
  document.getElementById(wrong[0]!.id)?.focus?.();
}
