---
type: log-entry
date: 2026-11-24T12:30
kind: Code
issues: [387]
---

The image `next` and the complete run at night (#387, parts 2 and 3; owner, 2026-11-23 and 2026-11-24). `next-image.yml` builds `next` after every green CI push run on `main` for `linux/amd64` and `linux/arm64`, with the short commit in `VERSION` and the label `org.opencontainers.image.revision`, and moves it only while the run is still the head of `main`; `rc-image.yml` and the candidate numbers are gone, and `docs/operations.md` names `next` for a test server. `ci.yml` runs every night on `main`: the unit suite, the E2E suite, the image with the Compose stack and the upgrade test and the website, without the mutation jobs, which `mutation.yml` runs complete the same night next to the migration property tests of `migrations-nightly.yml`. The loop looks at the nightly results first and fixes a failure through a pull request into `main` before any other work.
