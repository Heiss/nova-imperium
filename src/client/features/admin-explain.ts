// The „?“ of a setting of the admin panel opens its explanation (#358); the
// panel itself closes with Esc and „Schließen“ (AdminExplainPanel.svelte).
import { adminExplain } from '../views/admin-explain-state.svelte.ts';
import type { ClientFeature } from './contract.ts';

/**
 * Opens the explanation of `key` from the „?“ `opener`, or closes it when the
 * same „?“ opened it.
 */
export function toggleExplain(
  key: string | undefined,
  opener: string | undefined,
): void {
  if (!key || !opener) return;
  const same = adminExplain.key === key && adminExplain.opener === opener;
  adminExplain.key = same ? null : key;
  adminExplain.opener = same ? null : opener;
}

export const clientFeature = {
  acts: () => ({
    adminExplain: (d) => toggleExplain(d.k, d.o),
  }),
} satisfies ClientFeature;
