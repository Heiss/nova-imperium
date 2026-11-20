// What the page „Optionen“ shows (#118, bundle 5; okf/architecture/
// patterns.md, section 9), without the HTML of its parts: the choices of the
// player, the main planet, the vacation mode, the archive of the rounds, the
// display, the account boxes, the push kinds, the form „Problem melden“ and
// the link to the Lexicanum. The component Options renders it. The ids and
// `data-act`s belong to features/ (options.ts, playtime.ts, passkeys.ts,
// install.ts, push.ts, report-problem.ts, round-archive.ts) and to main.ts
// (the forms and `o_anim`); the boxes that a feature fills after the render
// (`#own-activity`, `#passkey-list`) are plain elements of the component.
import { ERROR_FIELDS } from '../../core/error-log.ts';
import type { RoundRules } from '../../core/round.ts';
import type { V } from '../views/common.ts';
import { articleHref } from './address.ts';
import { type Choice, explainChoices } from './explain.ts';
import { levelChoices } from './level-mode.ts';
import { type MainPlanetBox, mainPlanetBox } from './main-planet.ts';
import { type PushKind, pushKinds, shownPushOff } from './push-options.ts';
import { reportContextText } from './error-report.ts';
import {
  type ArchivePage,
  archivePage,
  shownArchive,
} from './round-archive.ts';
import { vacationIntro } from './vacation.ts';

/** The article of the Lexicanum that replaced the box „Regeln dieses Universums“ (#288, B4). */
const UNIVERSE_ARTICLE = 'rule-universe';

/** The sentence of the box „Account löschen“ and what it says of a guild (#191). */
export const deleteAccountText = (round: Pick<RoundRules, 'guilds'>): string =>
  `Dein Konto und deine Spielstände werden dauerhaft gelöscht.${round.guilds ? ' Leitest du eine Gilde, wird sie aufgelöst.' : ''}`;

/** The form „Problem melden“: what it sends along and shows above the text. */
interface ReportForm {
  page: string;
  version: string;
  requestId: string;
  /** The line above the field: page, version and last request. */
  context: string;
  /** The longest report the server takes. */
  max: number;
}

/** What the page shows. */
export interface OptionsPage {
  probes: number;
  explain: Choice[];
  levels: Choice[];
  main: MainPlanetBox;
  /** The first paragraph of the box „Urlaubsmodus“. */
  vacation: string;
  /** The content of the box „Rundenarchiv“ (logic/round-archive.ts, shared with the admin). */
  archive: ArchivePage;
  animations: boolean;
  /** The shortest password the server takes, once it has said so. */
  passwordMinLength: number | undefined;
  /** The checkboxes of the push kinds; none on a server without Web Push. */
  pushKinds: PushKind[] | null;
  report: ReportForm;
  deleteAccount: string;
  universe: { article: string; href: string };
}

/** The page at the view state `v`. */
export function optionsPage(v: V): OptionsPage {
  const { s, ui } = v;
  const requestId = ui.lastRequestId ?? null;
  const version = ui.news?.version ?? '';
  return {
    probes: s.me.probes || 1,
    explain: explainChoices(s.me.explain),
    levels: levelChoices(s.me.levelTable),
    main: mainPlanetBox(s, v.now),
    vacation: vacationIntro(s.round.vacationHours),
    archive: archivePage(shownArchive(s)),
    animations: !!ui.animations,
    passwordMinLength: ui.passwordMinLength,
    pushKinds: pushKinds(
      ui.webPush,
      shownPushOff(ui, s.me.pushOff),
      s.round.guilds,
    ),
    report: {
      page: ui.view,
      version,
      requestId: requestId ?? '',
      context: reportContextText({
        page: ui.view,
        version,
        requestId,
      }),
      max: ERROR_FIELDS.report,
    },
    deleteAccount: deleteAccountText(s.round),
    universe: {
      article: UNIVERSE_ARTICLE,
      href: articleHref(UNIVERSE_ARTICLE),
    },
  };
}
