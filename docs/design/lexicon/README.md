# Lexicon – design study

Design study for the in-game lexicon (#285). Not decided, apart from what
is marked **[E]**: texts and the layout are proposals **[V]**. **[E]**
(owner, 2026-11-17) It is called „Lexicanum“. Interface v2
(`src/client/static/style.css`) plus `mock.css`.

The pictures show the real game with a seeded player (Auspex-Lehre 4,
Scholarium 6, 12 Spähschädel, speed ×5); only the lexicon itself is put
into the page. Its tables are **computed from the rules of the game** by a
script, not typed: names, short and long texts from the catalog texts,
costs from `lvlCost`, times from `researchTime`, the report table from
`spyScore`, the danger table from `counterChance`, „Wird gebraucht für“
from the requirements of all catalog entries, rapid fire from the combat
values, and the constants `DEBRIS_SHARE` and `MAX_MOON_CHANCE`. The six
battle rounds, the 1 %, 70 % and 50 % of the battle page and the report
levels 2 / 3 / 5 / 7 are typed in the study, because the code does not
export them today (`MAX_ROUNDS`, `SPY_LEVELS` and others are private or in
server files); exporting them is part of the feature.

**[E]** (owner, 2026-11-17) The texts of the lexicon may use everyday
language and formulas: first words that say how something scales, then
the formula (see the article of the Auspex-Lehre).

Files:

- `lexicanum-seitenleiste.png` – **[E]** (owner, 2026-11-17) on a desktop the
  „?“ of a list entry opens the lexicon as a side panel over the list, in
  place of the text that unfolds below the entry today; the panel has a
  link that opens the same article on the lexicon page. **[E]** The side
  panel has no search; the search is on the page. **[E]** On a phone the
  „?“ opens the lexicon page itself, without a side panel
- `lexicanum-ablauf.webp` – animation (27 s, desktop): the „?“ at the
  Auspex-Lehre opens the side panel, its link opens the article on the
  page, and „Siehe auch“ leads to the matching question
- `lexicanum-start.html` / `.png` – the page „Lexikon“ with its own menu
  entry: search, „Einstieg“, „Häufige Fragen“, „Nachschlagen“ (the catalog)
  and „Regeln“
- `lexicanum-suche.png` – the search, open, with results grouped by kind
- `lexicanum-forschung.html` / `.png` – the article of a catalog entry
  (Auspex-Lehre): the texts of the catalog as the introduction, what the
  levels bring, the level table of the level overview (#187), requirements
  in both directions, links to other articles, the player's own level
- `lexicanum-frage.html` / `.png` – a question („Wie bekomme ich mehr
  Informationen über den Gegner?“) answered in steps with links
- `lexicanum-regel.html` / `.png` – a rule page (Kampf) with computed values
  and the rapid fire table
- `lexicanum-handy-start.png`, `lexicanum-handy-forschung.png`,
  `lexicanum-handy-tabelle.png` – the page on a phone; a wide table scrolls
  sideways inside its frame

The HTML files reference `/style.css`, `/fonts/` and `/icons/` absolutely:
serve them from a root that holds `src/client/static/` with this folder
beside it, or look at the PNGs.
