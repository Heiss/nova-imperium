---
type: process
title: Release loop
description: How Claude works through a release with /loop - plan with the owner, clarify, build, make the release pull request ready, stop.
---

# Release loop

The owner runs `/loop` in Claude Code without a prompt; Claude Code then
reads `.claude/loop.md` (project file, plain Markdown, at most 25,000 bytes,
edits apply from the next iteration). Without an interval Claude chooses the
pause itself, between one minute and one hour, and ends the loop with
`ScheduleWakeup` and `stop`. A loop runs only while the session runs and
ends after seven days at the latest (Claude Code documentation on scheduled
tasks).

* **[E]** One step per iteration, chosen from the state on GitHub in this
  order: finish the own open pull request, make the release ready (all
  issues of the milestone closed), plan the release (no open milestone),
  clarify the next issue, build it (owner, 2026-11-12). Releasing needs an
  open milestone, so a closed one never triggers it again.
* **[V]** Questions to the owner are asked with the question tool inside the
  iteration; the iteration waits for the answer and continues with it. An
  issue counts as clarified when it has a comment that starts with
  `Geklärt` and lists the decisions with the OKF link.
* **[E]** The loop asks the owner first what a release should bring, with
  proposals from the open issues; **infrastructure first**, features after
  it (owner, 2026-11-12). The chosen issues form the milestone
  `next release`.
* **[E]** When every issue of the milestone is closed and the release pull
  request is green with its candidate image, the loop tells the owner and
  **stops**. The owner merges the release pull request; that is the release
  (owner, 2026-11-12, [Branching and release](/ops/branching-release.md)).
* **[E]** The release pull request, `CHANGELOG.md` and `VERSION` come only
  from `scripts/release-pr.sh`: the changelog section from the fragments,
  the version from the tags, the list of pull requests from the Git
  history (squash commits ending in `(#N)`). The loop never writes them
  by hand; it refreshes them by running the workflow (owner, 2026-11-12).
* **[E]** The rules of the project stay as they are: ask instead of
  assuming, 3 to 5 options per decision, merges under O4, never a merge of a
  release pull request.
* **[E]** Up to two own pull requests may be open at a time; subagents build
  issues that don't depend on each other in their own git worktrees, Claude
  reviews each diff and opens, finishes and merges the pull requests itself
  (owner, 2026-11-12; replaces „one own pull request at a time“).
* **[E]** Local Stryker runs before a push only for changed logic files whose
  score is less than about 2 points above their floor in
  `mutation-standard.json` (for example `economy.ts`, `settle.ts`,
  `actions.ts`); data and interface files such as `catalog.ts` or
  `icons.ts` are left to the CI mutation job. A local run does not speed up
  the CI, which keeps its own incremental cache; it only saves a red run
  (owner, 2026-11-12).
* **[E]** Claude bundles pushes: while the CI of a pull request runs, no
  push of documentation or OKF alone (for example confirmed [V] → [E]); such
  changes go with the next code push, or are pushed before the pull request
  is marked ready. Every push cancels the running CI and starts all jobs
  again (owner, 2026-11-12).
* **[V]** Guards from loop engineering practice: a stop condition a machine
  can check (milestone closed, release pull request green), the state read
  fresh in every iteration, small reviewable steps, tests never weakened,
  and a hand-back to the owner after two failed attempts at one problem.
* **[V]** While the loop waits on CI or a review it wakes every 20 to 30
  minutes; GitHub events of subscribed pull requests wake it earlier.
* **[U]** Milestones are managed through the GitHub tools of the session;
  whether they can set a milestone on an issue is checked in the first
  planning iteration.
