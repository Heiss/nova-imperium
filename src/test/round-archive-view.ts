// The round archive as markup, for the tests of the component RoundArchive
// (#118, bundle 7): rendered on the server side of Svelte, without its
// comments.
import { render } from 'svelte/server';
import {
  type ArchiveState,
  archivePage,
} from '../client/logic/round-archive.ts';
import RoundArchive from '../client/views/RoundArchive.svelte';
import { stripComments } from './markup.ts';

export const archiveView = (a: ArchiveState, admin = false): string =>
  stripComments(
    render(RoundArchive, { props: { page: archivePage(a, admin) } }).body,
  );
