// What the Lexicanum shows now (#285): the article of the page, from the
// address, and the entry of the side panel. Part of the start bundle; the
// components that read it load on demand.

class LexicanumState {
  /** The article of the page (`?view=lexicanum&a=…`); '' for the start page. */
  article = $state('');
  /** The entry the side panel shows; null while it is closed. */
  panel = $state<string | null>(null);
}

export const lex = new LexicanumState();
