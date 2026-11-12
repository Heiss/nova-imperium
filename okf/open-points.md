---
type: Open Questions
title: Open points
description: What the owner still decides, checks or sets up; the proposals of the assistant to review.
tags: [open, review]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

The IDs are referenced in the pull request. Settled points stay listed with
their result.

# A. To decide by the owner

| ID | Topic | State and options |
|---|---|---|
| O1 | systemd unit | Version 1 had `nova-imperium.service`. It was removed because the start changed (build step, `.env`, secrets) and only Docker is tested. Options: leave it out; add an untested unit with `EnvironmentFile`; add a tested unit with a CI job. |
| O2 | Minimum password length | Kept at 6 like version 1. Options: keep 6; 8; 12; a passphrase rule. |
| O3 | Ranges of the universe settings | Proposals in [Admin](/features/admin.md) (speed 1 to 100, galaxies up to 9, …). Confirm or change. |

# B. Tasks of the owner

| ID | Topic | State |
|---|---|---|
| O5 | Branch protection | Make "CI Gate" a required check of `main`. |
| O6 | Renovate | Install the Renovate app for the repository. |
| O7 | GHCR | After the first tag the package is private; set it public or log in on the server. |
| O8 | First run on the server | Domain, reverse proxy, `.env`, SMTP password file, first invitation and `nova admin`. |
| O10 | Release App and labels | The release App needs „Pull requests: Read and write“ for the release pull request (until then the workflow fails when it opens it). Create the label `kein-changelog`. Allow force pushes to `release/*` for the App; protect `hotfix/**` like `main` (decided 2026-11-12: only pull requests with a green CI Gate) ([Branching and release](/ops/branching-release.md)). |
| O9 | Up-to-date branches | Settled 2026-11-10: "Require branches to be up to date before merging" is enabled for `main` (owner), so the migration check and all other checks run against the current `main` ([SQLite storage](/data/sqlite.md)). |

# C. Unverified

| ID | Claim | How to check |
|---|---|---|
| U1 | The CI workflows run green on GitHub. | The first run of this pull request. |
| U2 | The reverse proxy snippets for Caddy and nginx in `docs/operations.md` work. | First real setup. |
| U3 | The arm64 image starts on real arm64 hardware. | A Raspberry Pi or an arm64 server. |
| U4 | Invitation mails reach real inboxes (SPF, DKIM of the sender domain). | First invitation through the real SMTP server; Mailpit only checks sending. |
| U5 | A look with a screen reader and the keyboard. | Manual; axe covers a part only. |

# D. Settled

| Topic | Result |
|---|---|
| Interface never clicked through (hand-over note) | Covered by the E2E suite on every pull request. |
| Old JSON state | Not imported (round 1). |
| O4 Merging | The assistant merges its pull requests itself after a green CI Gate and with no open review findings (owner, 2026-11-10). |
| O11 Model of places | Coordinates plus kind (`planet \| moon \| debris`), moons as rows of `planets`, debris in its own table, position 16 with #93; built as migration step 8 before #45 and #53 (owner, 2026-11-12, [Design patterns](/architecture/patterns.md)). |
