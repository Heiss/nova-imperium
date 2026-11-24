// „Optionen“, the data of the box of the archive of the rounds (#235), shared
// with the admin.
import {
  type ArchivePage,
  archivePage,
  shownArchive,
} from '../round-archive.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface ArchivePart {
  /** The content of the box „Rundenarchiv“ (logic/round-archive.ts, shared with the admin). */
  archive: ArchivePage;
}

/** The archive that was read for this account and round only. */
export const archivePart = ({ s }: OptionsState): ArchivePart => ({
  archive: archivePage(shownArchive(s)),
});
