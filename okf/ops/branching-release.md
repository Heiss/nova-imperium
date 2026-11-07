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
  no `v`). The tag workflow runs the whole CI again; only then the image is
  built for linux/amd64 and linux/arm64 and pushed to
  `ghcr.io/heiss/nova-imperium:<tag>` and `:latest`, and a GitHub release is
  created. "Run workflow" by hand is a dry run.
* **[E]** Run `bash scripts/release.sh` from a clean local `main`. It checks
  GitHub CI on the fetched commit before fast-forwarding and pushing the next
  annotated tag. The first release of each Europe/Berlin calendar month uses
  micro version 0. A repeat on the same commit in that month reuses its tag.
* **[E]** Renovate opens pull requests for dependencies and images, waits
  3 days after a release (`minimumReleaseAge`) and merges patch updates
  automatically once the CI is green.
* **[E]** The complete mutation run happens every night on `main`
  (`.github/workflows/mutation.yml`).

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
