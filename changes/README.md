# Changelog fragments

Every pull request that players can notice adds one file here (owner,
2026-11-12). The release pull request bundles all files into a German
section of `CHANGELOG.md`, which the game shows under „Neuigkeiten“, and
removes them. See `okf/ops/branching-release.md`.

- One file per change, named after it: `changes/nanitenfabrik.md`.
- German, written for players: what changes for them, no code, no internals,
  nothing a player should find out by playing. At most 300 characters, no
  headings.
- `art` is `neu`, `geändert` or `behoben`. The game sorts new, then changed,
  then fixed; the update message shows the first three.

```markdown
---
art: neu
---

Nanitenfabrik: halbiert die Bau- und Werftzeiten jeder Stufe und sperrt
die Werft, solange sie ausgebaut wird.
```

A pull request that changes `src/client`, `src/shared` or `src/server/game`
needs a fragment; the CI check „Changelog fragments“ enforces it. Changes
players cannot notice (refactoring, tests, tooling) carry the label
`kein-changelog` instead.
