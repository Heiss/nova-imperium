// The actions of the links of the Lexicanum (#285): the navigation of the
// frame, the „?“ of a list entry and the links of an article. The page, the
// side panel and the articles are in views/lexicanum.ts and its components.
import { LEXICANUM_VIEW } from '../logic/address.ts';
import { urlOf } from '../view-address.ts';
import {
  closePanel,
  goTo,
  openArticle,
  useNavigation,
} from '../views/lexicanum-nav.ts';
import { lex } from '../views/lexicanum-state.svelte.ts';
import { openEntry } from '../views/lexicanum.ts';
import type { ClientFeature } from './contract.ts';

/** nav, explain and the links of the Lexicanum. */
export const clientFeature = {
  acts: ({ go }) => {
    useNavigation(go, urlOf);
    return {
      // The navigation of main.ts; the menu entry of the Lexicanum opens its
      // start page, also from an article.
      nav: (d) =>
        d.v === LEXICANUM_VIEW ? openArticle('') : goTo(d.v ?? 'overview'),
      explain: (d) => openEntry(d.k ?? ''),
      lex: (d) => openArticle(d.a ?? ''),
      lexPanel: (d) => {
        if (lex.opener) lex.panel = d.a ?? lex.opener;
      },
      lexClose: () => closePanel(),
    };
  },
} satisfies ClientFeature;
