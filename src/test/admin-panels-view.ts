// The panels of the page „Admin“ that fill themselves as markup, for the
// tests of the components (#118, after bundle 7): the state of
// logic/admin-panels.svelte.ts set to what the test says, rendered on the
// server side of Svelte, without its comments.
import { render } from 'svelte/server';
import {
  type ErrorPage,
  errorRange,
  EVENT_FIELDS,
  type EventPage,
  type Fields,
  type Invitation,
  type Order,
  type PlayerDetail,
  type PlayerStats,
} from '../client/logic/admin-panels.ts';
import { panels } from '../client/logic/admin-panels.svelte.ts';
import type { Players } from '../client/logic/types.ts';
import AdminDiagnostics from '../client/views/AdminDiagnostics.svelte';
import AdminErrors from '../client/views/AdminErrors.svelte';
import AdminInvitations from '../client/views/AdminInvitations.svelte';
import { stripComments } from './markup.ts';

/** What the panel of the diagnostics holds. */
export interface Shown {
  tab: 'events' | 'players' | 'orders';
  fields?: Fields;
  events?: EventPage;
  stats?: PlayerStats[];
  record?: { person: PlayerStats; detail: PlayerDetail };
  orders?: { orders: Order[]; now: number };
  notice?: string;
  /** The cap of the moon chance of the round (#433); 20 by default. */
  moonCap?: number;
}

export const diagnosticsView = (players: Players, x: Shown): string => {
  Object.assign(panels, {
    tab: x.tab,
    fields: x.fields ?? { ...EVENT_FIELDS },
    events: x.events ?? null,
    stats: x.stats ?? null,
    record: x.record ?? null,
    orders: x.orders ?? null,
    notice: x.notice ?? null,
  });
  // The default cap of the moon chance, as the frozen HTML had it (#433).
  const moonCap = x.moonCap ?? 20;
  return stripComments(
    render(AdminDiagnostics, { props: { players, moonCap } }).body,
  );
};

export const errorsView = (
  now: number,
  data?: ErrorPage,
  notice?: string,
  filter?: Fields,
): string => {
  Object.assign(panels, {
    range: errorRange(now),
    errorFields: filter ?? { kind: '', limit: '10' },
    errors: data ?? null,
    errorNotice: notice ?? null,
  });
  return stripComments(render(AdminErrors).body);
};

export const invitationsView = (
  shown: { list: Invitation[] } | { error: string } | null,
): string => {
  panels.invitations = shown;
  return stripComments(render(AdminInvitations).body);
};
