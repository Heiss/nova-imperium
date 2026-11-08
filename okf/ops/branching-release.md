---
type: Process
title: Branching and release
description: Pull requests, the CI Gate, CalVer tags with images on GHCR, Renovate.
tags: [git, branching, release, ci, renovate]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** GitHub Flow as in muffelblog: `main` is always deliverable; work
  happens on a branch and reaches `main` through a pull request.
* **[E]** This setup is one pull request with clean commits (round 1); it is
  merged with a squash merge.
* **[E]** Only a pull request with a green "CI Gate" goes to review.
* **[E]** Release: a Git tag in CalVer `YY.M.MICRO` (for example `26.11.0`,
  no `v`). The tag workflow verifies a successful CI push run on `main`
  for the exact tagged commit. It then builds the image for linux/amd64 and linux/arm64 and pushed to
  `ghcr.io/heiss/nova-imperium:<tag>` and `:latest`, and a GitHub release is
  created. "Run workflow" by hand is a dry run.
* **[E]** After successful push CI, GitHub Actions tags the tested commit if it
  is still the tip of `main`. The automatic tag uses the release App token
  so the tag push starts the image workflow. The first release each month
  in Europe/Berlin uses micro version 0, and a repeat on the same commit
  within the month reuses its tag. The tag ruleset reserves creation for the
  release App.
* **[E]** Renovate opens pull requests for dependencies and images, waits
  3 days after a release (`minimumReleaseAge`) and merges patch updates
  automatically once the CI is green.
* **[E]** Every push to `main` runs the full suite, including a complete mutation
  run. The nightly complete mutation run remains in
  `.github/workflows/mutation.yml`.

# Tasks of the owner (one-time)

* Make "CI Gate" a required check of `main` (Settings → Branches), so
  Renovate's auto-merge waits for it.
* Install the Renovate app for the repository.
* After the first release: set the GHCR package to public, or log in with a
  token that has `read:packages` on the server.

# Proposals

* **[V]** The assistant does not merge its own pull requests here; the owner
  reviews and merges (in muffelblog the owner allowed the assistant to merge
  after a green CI; for this project that was not asked).
