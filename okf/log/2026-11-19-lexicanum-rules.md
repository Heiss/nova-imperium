---
type: log-entry
date: 2026-11-19T20:00
kind: Decision and code
issues: [288, 222]
---

#288, stage 2 of the Lexicanum: rule pages and questions in place of the box „Regeln dieses Universums“. 18 rule pages (Kampf, Auspex-Erkundung, Flug und Treibstoff, Trümmerfelder und Bergung, Monde, Planeten und Felder, Kolonien und Planetengrenze, Produktion Energie und Lager, Bauen Forschen und Schiffsschmiede, Schutz der Schwachen, Urlaubsmodus, Sichtbarkeit und Aktivität, Tagesbelohnung und Erfolge, Highscore, Marktplatz, Gilden, Endzeit, Dieses Universum) and 8 questions are `PageDef`s under `src/core/lexicon/pages/`, computed from the rules and the settings of the round, with formulas that the guards compare with their rules; the start page has the boxes „Regeln“ and „Häufige Fragen“, the search finds the pages. The rules the pages read moved into `src/core` (battle numbers, `loot.ts`, `points.ts`, `unprotectedFrom`, `harvest`, constants of the achievements and the daily reward); the server imports them. „Hilfe & Optionen“ is „Optionen“ and links „Dieses Universum“. The texts are drafts [V] (owner, 2026-11-19, #222), all in the review list [Lexicanum texts](/features/lexicanum-texts.md); see [Lexicanum](/features/lexicanum.md).
