// „Optionen“, the data of the link to the rules of this universe in the
// Lexicanum, which replaced the box „Regeln dieses Universums“ (#288, B4).
import { articleHref } from '../address.ts';

/** The article of the Lexicanum it links. */
const UNIVERSE_ARTICLE = 'rule-universe';

/** The part of the page the line shows. */
export interface UniversePart {
  universe: { article: string; href: string };
}

/** The article and its address. */
export const universePart = (): UniversePart => ({
  universe: {
    article: UNIVERSE_ARTICLE,
    href: articleHref(UNIVERSE_ARTICLE),
  },
});
