---
type: log-entry
date: 2026-11-28T10:55
kind: Decision
issues: [486, 387, 456]
---

The owner's decision on the images (2026-11-28, #486, not built yet): the moving tag `next` of #387 goes away and `nightly` takes its place. It is built and published only when the three night workflows (`ci.yml` on its schedule, `mutation.yml`, `migrations-nightly.yml`) are green for the same commit of `main`, and not again while `main` is unchanged; there are no dated tags. A release keeps `<version>`, `latest` and `stable`. The owner's staging server pulls `nightly` by itself, and the repository only describes it. Proposed [V]: the same checks as the release image (both platforms, the no-AVX check of #456, Trivy), `VERSION` the short commit, the old `next` left in GHCR ([Branching and release](/ops/branching-release.md)).
